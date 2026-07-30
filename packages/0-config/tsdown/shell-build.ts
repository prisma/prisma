import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { init as initLexer, parse as parseModule } from 'es-module-lexer';
import type { UserConfig } from 'tsdown';
import { defineConfig } from './base.ts';
import { excludedSubpaths, publicShells, type ShellName } from './shells.ts';

/** A shell build configuration or mapping-table inconsistency. */
class ShellConfigError extends Error {}

interface InternalPackage {
  readonly name: string;
  readonly dir: string;
  readonly absDir: string;
  readonly entry: string;
  readonly shell: ShellName;
  readonly exports: Record<string, unknown>;
  readonly dependencies: Record<string, string>;
  readonly peerDependencies: Record<string, string>;
}

/**
 * Build configuration for a public publish shell (ADR 242).
 *
 * Generates one re-export entry per export subpath of each internal package
 * mapped to the shell, bundles all of them in a single rolldown build (shared
 * modules land in shared chunks, preserving module identity within the shell),
 * and rewrites imports of internal packages that belong to *other* shells to
 * their published entrypoints, marking them external.
 */
export async function defineShellConfig(shellName: ShellName): Promise<UserConfig> {
  const shell = publicShells.get(shellName);
  if (shell === undefined) throw new ShellConfigError(`unknown shell ${shellName}`);
  const shellDir = process.cwd();
  const repoRoot = findRepoRoot(shellDir);
  if (resolve(repoRoot, shell.dir) !== shellDir) {
    throw new ShellConfigError(
      `shell config for ${shellName} must run from ${shell.dir}, got ${shellDir}`,
    );
  }

  const lookup = readAllInternalPackages(repoRoot);
  const internals = [...lookup.values()].filter((pkg) => pkg.shell === shellName);

  await initLexer;

  const srcDir = join(shellDir, 'src');
  rmSync(srcDir, { recursive: true, force: true });

  const entry: Record<string, string> = {};
  for (const pkg of internals) {
    for (const [subpath, value] of Object.entries(pkg.exports)) {
      if (subpath === './package.json') continue;
      if (excludedSubpaths.some((pattern) => pattern.test(subpath))) continue;
      const distFile = resolveExportTarget(value);
      if (distFile === undefined) {
        throw new ShellConfigError(
          `unsupported exports value for ${pkg.name} ${subpath}: ${JSON.stringify(value)}`,
        );
      }
      const entryName = subpath === '.' ? pkg.entry : `${pkg.entry}/${subpath.slice(2)}`;
      const specifier = subpath === '.' ? pkg.name : `${pkg.name}/${subpath.slice(2)}`;
      // Flat file names: the dts plugin names declaration outputs after the
      // entry file's basename, so nested entry paths would strand every
      // `.d.mts` at the dist root (with hash-renaming on basename
      // collisions), away from its `.mjs` sibling. `__` maps back to `/` in
      // the generated exports map (see `shellExports`).
      const flatName = entryName.replaceAll('/', '__');
      const entryFile = join(srcDir, `${flatName}.ts`);
      mkdirSync(dirname(entryFile), { recursive: true });
      writeFileSync(entryFile, entryModuleSource(specifier, join(pkg.absDir, distFile)));
      entry[flatName] = `src/${flatName}.ts`;
    }
  }

  const binFiles = new Set<string>();
  for (const [binName, binFile] of Object.entries(shell.bins ?? {})) {
    const flatName = `bin__${binName}`;
    const entryFile = join(srcDir, `${flatName}.mjs`);
    const binPath = resolve(repoRoot, binFile);
    binFiles.add(binPath);
    mkdirSync(dirname(entryFile), { recursive: true });
    writeFileSync(entryFile, `import '${binPath}';\n`);
    entry[flatName] = `src/${flatName}.mjs`;
  }

  validateShellManifest(shellName, shellDir, internals, lookup);

  return defineConfig({
    entry,
    copy: (shell.copy ?? []).map((pattern) => ({ from: resolve(repoRoot, pattern) })),
    skipNodeModulesBundle: false,
    external: (id: string) => /^[@a-zA-Z]/.test(id) && !id.startsWith('@prisma-next/'),
    dts: { enabled: true, sourcemap: true },
    exports: {
      enabled: 'local-only',
      customExports: shellExports,
      bin:
        Object.keys(shell.bins ?? {}).length > 0
          ? Object.fromEntries(
              Object.keys(shell.bins ?? {}).map((binName) => [
                binName,
                `./src/bin__${binName}.mjs`,
              ]),
            )
          : false,
    },
    plugins: [crossShellRewritePlugin(shellName, lookup), binSideEffectsPlugin(binFiles)],
    outputOptions: (options) => ({
      ...options,
      banner: (chunk: { name: string }) =>
        chunk.name.startsWith('bin__') ? '#!/usr/bin/env node\n' : '',
    }),
  });
}

/**
 * Expand the flat `__`-separated output names back into `/`-separated public
 * subpaths, and drop bin entries (installed via the `bin` field, never
 * importable).
 */
function shellExports(exports: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(exports)) {
    if (key.includes('bin__')) continue;
    out[key.replaceAll('__', '/')] = value;
  }
  return out;
}

function entryModuleSource(specifier: string, distFile: string): string {
  const lines = [`export * from '${specifier}';`];
  if (hasDefaultExport(distFile)) {
    lines.push(`export { default } from '${specifier}';`);
  }
  return `${lines.join('\n')}\n`;
}

function hasDefaultExport(distFile: string): boolean {
  const [, exports] = parseModule(readFileSync(distFile, 'utf8'));
  return exports.some((e) => e.n === 'default');
}

function resolveExportTarget(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (isRecord(value)) {
    const target = value['import'] ?? value['default'];
    if (typeof target === 'string') return target;
  }
  return undefined;
}

function publicSpecifier(
  source: string,
  shellName: ShellName,
  lookup: Map<string, InternalPackage>,
): { shell: ShellName; id: string } {
  const [scope, name, ...rest] = source.split('/');
  const target = lookup.get(`${scope}/${name}`);
  if (target === undefined) {
    throw new ShellConfigError(
      `import of ${source} in shell ${shellName} has no public shell mapping`,
    );
  }
  const subpath = rest.join('/');
  const id =
    subpath === ''
      ? `${target.shell}/${target.entry}`
      : `${target.shell}/${target.entry}/${subpath}`;
  return { shell: target.shell, id };
}

function crossShellRewritePlugin(shellName: ShellName, lookup: Map<string, InternalPackage>) {
  return {
    name: 'prisma-public-shell-rewrite',
    resolveId(source: string) {
      if (!source.startsWith('@prisma-next/')) return null;
      const target = publicSpecifier(source, shellName, lookup);
      if (target.shell === shellName) return null;
      return { id: target.id, external: true };
    },
    // The dts bundler leaves inline `import("@prisma-next/...")` type
    // references (copied verbatim from the internal declaration files) in the
    // emitted output; rewrite them to published specifiers. Same-shell
    // references become self-references, which TypeScript resolves through
    // the shell's own exports map.
    generateBundle(_options: unknown, bundle: Record<string, { type: string; code?: string }>) {
      for (const [fileName, output] of Object.entries(bundle)) {
        if (!fileName.endsWith('.d.mts') || output.type !== 'chunk') continue;
        if (typeof output.code !== 'string') continue;
        output.code = output.code.replace(
          /import\((["'])(@prisma-next\/[^"')]+)\1\)/g,
          (_match, quote: string, source: string) =>
            `import(${quote}${publicSpecifier(source, shellName, lookup).id}${quote})`,
        );
      }
    },
  };
}

/**
 * Bin dist files run the program via top-level side effects, but the internal
 * packages declare `sideEffects: false`, so without this the bundle
 * tree-shakes the whole CLI away.
 */
function binSideEffectsPlugin(binFiles: ReadonlySet<string>) {
  return {
    name: 'prisma-public-shell-bin-side-effects',
    resolveId(source: string) {
      if (!binFiles.has(source)) return null;
      return { id: source, moduleSideEffects: 'no-treeshake' as const };
    },
  };
}

function readAllInternalPackages(repoRoot: string): Map<string, InternalPackage> {
  const lookup = new Map<string, InternalPackage>();
  for (const [shellName, shell] of publicShells) {
    for (const mapping of shell.packages) {
      const absDir = resolve(repoRoot, mapping.dir);
      const manifest = readJson(join(absDir, 'package.json'));
      const name = stringField(manifest, 'name', mapping.dir);
      lookup.set(name, {
        name,
        dir: mapping.dir,
        absDir,
        entry: mapping.entry,
        shell: shellName,
        exports: recordField(manifest, 'exports'),
        dependencies: stringRecordField(manifest, 'dependencies'),
        peerDependencies: stringRecordField(manifest, 'peerDependencies'),
      });
    }
  }
  return lookup;
}

/**
 * The shell's manifest is hand-maintained; verify it declares exactly the
 * runtime dependencies the bundle needs: the union of the internals'
 * third-party dependencies plus one exact-pinned dependency per referenced
 * sibling shell.
 */
function validateShellManifest(
  shellName: ShellName,
  shellDir: string,
  internals: readonly InternalPackage[],
  lookup: Map<string, InternalPackage>,
): void {
  const manifest = readJson(join(shellDir, 'package.json'));
  const version = stringField(manifest, 'version', shellName);

  const expectedDeps = new Map<string, string>();
  const expectedPeers = new Map<string, string>();
  for (const pkg of internals) {
    for (const [dep, range] of Object.entries(pkg.dependencies)) {
      if (dep.startsWith('@prisma-next/')) {
        const target = lookup.get(dep);
        if (target === undefined) {
          throw new ShellConfigError(
            `${pkg.name} depends on ${dep}, which has no public shell mapping`,
          );
        }
        if (target.shell !== shellName) expectedDeps.set(target.shell, `workspace:${version}`);
        continue;
      }
      const existing = expectedDeps.get(dep);
      if (existing === undefined || range === 'catalog:') expectedDeps.set(dep, range);
    }
    for (const [dep, range] of Object.entries(pkg.peerDependencies)) {
      if (dep === 'typescript') continue;
      if (!expectedPeers.has(dep)) expectedPeers.set(dep, range);
    }
  }
  for (const dep of expectedDeps.keys()) expectedPeers.delete(dep);

  const errors: string[] = [];
  const actualDeps = stringRecordField(manifest, 'dependencies');
  const actualPeers = stringRecordField(manifest, 'peerDependencies');
  for (const [dep, range] of expectedDeps) {
    if (actualDeps[dep] !== range) {
      errors.push(
        `dependencies["${dep}"] should be "${range}", got ${JSON.stringify(actualDeps[dep])}`,
      );
    }
  }
  for (const dep of Object.keys(actualDeps)) {
    if (!expectedDeps.has(dep))
      errors.push(`dependencies["${dep}"] is not needed by any bundled internal package`);
  }
  for (const [dep, range] of expectedPeers) {
    if (actualPeers[dep] !== range) {
      errors.push(
        `peerDependencies["${dep}"] should be "${range}", got ${JSON.stringify(actualPeers[dep])}`,
      );
    }
  }
  if (errors.length > 0) {
    throw new ShellConfigError(
      `${shellName} package.json is out of sync with its internal packages:\n  ${errors.join('\n  ')}`,
    );
  }
}

function findRepoRoot(from: string): string {
  let dir = from;
  while (true) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new ShellConfigError(`could not find repository root above ${from}`);
    dir = parent;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJson(file: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!isRecord(parsed)) throw new ShellConfigError(`${file} does not contain a JSON object`);
  return parsed;
}

function stringField(manifest: Record<string, unknown>, field: string, context: string): string {
  const value = manifest[field];
  if (typeof value !== 'string') {
    throw new ShellConfigError(`package.json of ${context} has no string "${field}" field`);
  }
  return value;
}

function recordField(manifest: Record<string, unknown>, field: string): Record<string, unknown> {
  const value = manifest[field] ?? {};
  if (!isRecord(value)) throw new ShellConfigError(`package.json "${field}" is not an object`);
  return value;
}

function stringRecordField(
  manifest: Record<string, unknown>,
  field: string,
): Record<string, string> {
  const value = recordField(manifest, field);
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'string') {
      throw new ShellConfigError(`package.json "${field}"["${key}"] is not a string`);
    }
    out[key] = entry;
  }
  return out;
}
