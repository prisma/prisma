import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { init as initLexer, parse as parseModule } from 'es-module-lexer';
import type { UserConfig } from 'tsdown';
import { defineConfig } from './base.ts';
import { excludedSubpaths, publicShells, type ShellDefinition, type ShellName } from './shells.ts';

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

  // Generated entries live outside `src/` so turbo's `src/**` build input
  // never hashes a directory that only exists after a build.
  const srcDir = join(shellDir, 'src-gen');
  rmSync(srcDir, { recursive: true, force: true });
  mkdirSync(srcDir, { recursive: true });

  const entry: Record<string, string> = {};
  const addEntry = (entryName: string, fileName: string): string => {
    if (entryName.includes('__')) {
      throw new ShellConfigError(
        `entry name "${entryName}" contains "__", which is reserved as the flat-name separator`,
      );
    }
    // Flat file names: the dts plugin names declaration outputs after the
    // entry file's basename, so nested entry paths would strand every
    // `.d.mts` at the dist root (with hash-renaming on basename collisions),
    // away from its `.mjs` sibling. `__` maps back to `/` in the generated
    // exports map (see `shellExports`).
    const flatName = entryName.replaceAll('/', '__');
    if (entry[flatName] !== undefined) {
      throw new ShellConfigError(`duplicate shell entry name "${entryName}" in ${shellName}`);
    }
    entry[flatName] = `src-gen/${fileName.replaceAll('/', '__')}`;
    return join(srcDir, fileName.replaceAll('/', '__'));
  };

  const aggregates = new Map<string, Map<string, string[]>>();
  for (const pkg of internals) {
    const aggregated: { specifier: string; distFile: string }[] = [];
    let hasRootExport = false;
    for (const [subpath, value] of Object.entries(pkg.exports)) {
      if (subpath === './package.json') continue;
      if (excludedSubpaths.some((pattern) => pattern.test(subpath))) continue;
      const distFile = resolveExportTarget(value);
      if (distFile === undefined) {
        throw new ShellConfigError(
          `unsupported exports value for ${pkg.name} ${subpath}: ${JSON.stringify(value)}`,
        );
      }
      if (subpath === '.') hasRootExport = true;
      const entryName = shellEntryName(pkg.entry, subpath);
      const specifier = subpath === '.' ? pkg.name : `${pkg.name}/${subpath.slice(2)}`;
      const entryFile = addEntry(entryName, `${entryName}.ts`);
      writeFileSync(entryFile, entryModuleSource(specifier, join(pkg.absDir, distFile)));
      if (subpath !== '.') aggregated.push({ specifier, distFile: join(pkg.absDir, distFile) });
    }
    // The ADR names each internal package as a whole (`@prisma/orm-framework/contract`,
    // `@prisma/orm-target-postgres/adapter`, ...). When the internal package
    // has no root export, synthesize that aggregate from its subpath exports;
    // when it has one, the root export already owns the name. A package
    // occupying the shell's own namespace is the shell, so there is no
    // package-level name to synthesize.
    if (pkg.entry !== '' && !hasRootExport && aggregated.length > 0) {
      const expected = new Map<string, string[]>();
      for (const { specifier, distFile } of aggregated) {
        for (const name of moduleExports(specifier, distFile)) {
          if (name === 'default') continue;
          expected.set(name, [...(expected.get(name) ?? []), specifier]);
        }
      }
      aggregates.set(pkg.entry, expected);
      const entryFile = addEntry(pkg.entry, `${pkg.entry}.ts`);
      writeFileSync(
        entryFile,
        `${aggregated.map(({ specifier }) => `export * from '${specifier}';`).join('\n')}\n`,
      );
    }
  }

  // Forwarded surfaces: the generated modules import the sibling package by
  // its internal name, which the rewrite plugin turns into that sibling's
  // published entrypoint and marks external. Nothing is copied, so the
  // forwarded modules stay single-instance across the whole install.
  for (const mapping of shell.reexports ?? []) {
    const source = lookup.get(mapping.package);
    if (source === undefined) {
      throw new ShellConfigError(
        `${shellName} re-exports ${mapping.package}, which has no public shell mapping`,
      );
    }
    if (source.shell === shellName) {
      throw new ShellConfigError(
        `${shellName} re-exports ${mapping.package}, which it already publishes directly`,
      );
    }
    const hasSourceRootExport = Object.hasOwn(source.exports, '.');
    if (mapping.root !== false && !hasSourceRootExport) {
      // No root export upstream: forward the sibling shell's synthesized
      // package-level aggregate, which carries no default export.
      const entryFile = addEntry(mapping.entry, `${mapping.entry}.ts`);
      writeFileSync(entryFile, `export * from '${mapping.package}';\n`);
    }
    for (const [subpath, value] of Object.entries(source.exports)) {
      if (subpath === './package.json') continue;
      if (subpath === '.' && mapping.root === false) continue;
      if (excludedSubpaths.some((pattern) => pattern.test(subpath))) continue;
      const distFile = resolveExportTarget(value);
      if (distFile === undefined) {
        throw new ShellConfigError(
          `unsupported exports value for ${source.name} ${subpath}: ${JSON.stringify(value)}`,
        );
      }
      const entryName = shellEntryName(mapping.entry, subpath);
      const specifier =
        subpath === '.' ? mapping.package : `${mapping.package}/${subpath.slice(2)}`;
      const entryFile = addEntry(entryName, `${entryName}.ts`);
      writeFileSync(entryFile, entryModuleSource(specifier, join(source.absDir, distFile)));
    }
  }

  const binFiles = new Set<string>();
  for (const [binName, binFile] of Object.entries(shell.bins ?? {})) {
    const binPath = resolve(repoRoot, binFile);
    binFiles.add(binPath);
    const entryFile = addEntry(`bin/${binName}`, `bin/${binName}.mjs`);
    writeFileSync(entryFile, `import '${binPath}';\n`);
  }
  for (const [binName, specifier] of Object.entries(shell.forwardedBins ?? {})) {
    const entryFile = addEntry(`bin/${binName}`, `bin/${binName}.mjs`);
    writeFileSync(entryFile, `import '${specifier}';\n`);
  }
  const binNames = [...Object.keys(shell.bins ?? {}), ...Object.keys(shell.forwardedBins ?? {})];

  validateShellManifest(shellName, shell, shellDir, internals, lookup);

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
        binNames.length > 0
          ? Object.fromEntries(
              binNames.map((binName) => [binName, `./src-gen/bin__${binName}.mjs`]),
            )
          : false,
    },
    plugins: [crossShellRewritePlugin(shellName, lookup), binSideEffectsPlugin(binFiles)],
    hooks: {
      'build:done': () => assertAggregatesComplete(shellName, shellDir, aggregates),
    },
    outputOptions: (options) => ({
      ...options,
      banner: (chunk: { name: string }) =>
        chunk.name.startsWith('bin__') ? '#!/usr/bin/env node\n' : '',
    }),
  });
}

/**
 * Entry name for one export subpath of an internal package. A package
 * mapped to the empty entry occupies the shell's own namespace, so its
 * root export becomes the shell's root export (`index`, which tsdown
 * renders as `"."`).
 */
function shellEntryName(entry: string, subpath: string): string {
  const tail = subpath === '.' ? '' : subpath.slice(2);
  if (entry === '') return tail === '' ? 'index' : tail;
  return tail === '' ? entry : `${entry}/${tail}`;
}

/**
 * Expand the flat `__`-separated output names back into `/`-separated public
 * subpaths. Bin entries keep an entrypoint (`./bin/<name>`) alongside the
 * `bin` field so a facade can forward the command without shipping a second
 * copy of the program.
 */
function shellExports(exports: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(exports)) {
    out[key.replaceAll('__', '/')] = value;
  }
  return out;
}

function entryModuleSource(specifier: string, distFile: string): string {
  const lines = [`export * from '${specifier}';`];
  if (moduleExports(specifier, distFile).includes('default')) {
    lines.push(`export { default } from '${specifier}';`);
  }
  return `${lines.join('\n')}\n`;
}

/** Export names of a built internal module, with a diagnosable error when the dist is missing. */
function moduleExports(specifier: string, distFile: string): string[] {
  let source: string;
  try {
    source = readFileSync(distFile, 'utf8');
  } catch {
    throw new ShellConfigError(
      `cannot read ${distFile} for ${specifier} — build the internal package first (pnpm build from the repository root)`,
    );
  }
  const [, exports] = parseModule(source);
  return exports.map((e) => e.n);
}

/**
 * A synthesized aggregate uses `export *`, and ECMAScript silently omits a
 * name when two star-exported modules bind it to *different* values (the
 * same binding reached through several subpaths is fine). Verify the built
 * aggregate exports the full union of its subpaths' names, and fail naming
 * every dropped export so a collision is a decision, not a hole in the
 * public surface.
 */
function assertAggregatesComplete(
  shellName: ShellName,
  shellDir: string,
  aggregates: ReadonlyMap<string, ReadonlyMap<string, string[]>>,
): void {
  const problems: string[] = [];
  for (const [entryName, expected] of aggregates) {
    const distFile = join(shellDir, 'dist', `${entryName}.mjs`);
    const actual = new Set(moduleExports(`${shellName}/${entryName}`, distFile));
    for (const [name, specifiers] of expected) {
      if (!actual.has(name)) {
        problems.push(
          `${shellName}/${entryName} dropped "${name}" (ambiguous between ${specifiers.join(', ')})`,
        );
      }
    }
  }
  if (problems.length > 0) {
    throw new ShellConfigError(
      `aggregate entrypoints lost exports to star-export ambiguity:\n  ${problems.join('\n  ')}`,
    );
  }
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
  const tail = target.entry === '' ? subpath : [target.entry, subpath].filter(Boolean).join('/');
  return { shell: target.shell, id: tail === '' ? target.shell : `${target.shell}/${tail}` };
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
  shell: ShellDefinition,
  shellDir: string,
  internals: readonly InternalPackage[],
  lookup: Map<string, InternalPackage>,
): void {
  const manifest = readJson(join(shellDir, 'package.json'));
  const version = stringField(manifest, 'version', shellName);

  const expectedDeps = new Map<string, string>();
  const expectedPeers = new Map<string, string>();
  const siblingShell = (pkg: InternalPackage, dep: string): ShellName => {
    const target = lookup.get(dep);
    if (target === undefined) {
      throw new ShellConfigError(
        `${pkg.name} depends on ${dep}, which has no public shell mapping`,
      );
    }
    return target.shell;
  };
  for (const pkg of internals) {
    for (const [dep, range] of Object.entries(pkg.dependencies)) {
      if (dep.startsWith('@prisma-next/')) {
        const target = siblingShell(pkg, dep);
        if (target !== shellName) expectedDeps.set(target, `workspace:${version}`);
        continue;
      }
      const existing = expectedDeps.get(dep);
      if (existing === undefined || range === 'catalog:') expectedDeps.set(dep, range);
    }
    for (const [dep, range] of Object.entries(pkg.peerDependencies)) {
      if (dep === 'typescript') continue;
      // An extension's peer on an internal adapter package becomes a peer on
      // the published target shell that carries it (ADR 242).
      if (dep.startsWith('@prisma-next/')) {
        const target = siblingShell(pkg, dep);
        if (target !== shellName) expectedPeers.set(target, `workspace:${version}`);
        continue;
      }
      if (!expectedPeers.has(dep)) expectedPeers.set(dep, range);
    }
  }
  for (const mapping of shell.reexports ?? []) {
    const source = lookup.get(mapping.package);
    if (source !== undefined && source.shell !== shellName) {
      expectedDeps.set(source.shell, `workspace:${version}`);
    }
  }
  for (const specifier of Object.values(shell.forwardedBins ?? {})) {
    const [scope, name] = specifier.split('/');
    expectedDeps.set(`${scope}/${name}`, `workspace:${version}`);
  }
  // A sibling shell the bundle imports directly is a hard dependency; the
  // peer declaration it also arrived through would only duplicate it.
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
