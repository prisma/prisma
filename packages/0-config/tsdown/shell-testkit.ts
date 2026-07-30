import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { init as initLexer, parse as parseModule } from 'es-module-lexer';

/** A tarball-install smoke-test failure with the offending command output attached. */
class ShellTestError extends Error {}

export interface PackedShell {
  readonly name: string;
  readonly tarball: string;
}

/** `pnpm pack` a shell package into `outDir`, returning the published name + tarball path. */
export function packShell(shellDir: string, outDir: string): PackedShell {
  const manifest: unknown = JSON.parse(readFileSync(join(shellDir, 'package.json'), 'utf8'));
  if (typeof manifest !== 'object' || manifest === null || !('name' in manifest)) {
    throw new ShellTestError(`${shellDir}/package.json has no name`);
  }
  const name = String(manifest.name);
  const tarball = join(outDir, `${name.replaceAll(/[@/]/g, '-').replace(/^-/, '')}.tgz`);
  execFileSync('pnpm', ['pack', '--out', tarball], { cwd: shellDir, stdio: 'pipe' });
  return { name, tarball };
}

/**
 * Install packed shells into a scratch project outside the workspace.
 *
 * Every shell is a pnpm override, so cross-shell dependencies (exact
 * lockstep versions that are not on the npm registry yet) resolve to the
 * local tarballs. `direct` narrows which of them the scratch project
 * *declares*, so a test can install one package the way an application
 * would and let the rest arrive transitively; by default all of them are
 * direct dependencies.
 */
export function installShells(
  scratchDir: string,
  shells: readonly PackedShell[],
  options: { readonly direct?: readonly string[] } = {},
): void {
  mkdirSync(scratchDir, { recursive: true });
  const fileDeps = Object.fromEntries(shells.map((s) => [s.name, `file:${s.tarball}`]));
  const direct = options.direct ?? shells.map((s) => s.name);
  const manifest = {
    name: 'shell-tarball-smoke',
    private: true,
    type: 'module',
    dependencies: Object.fromEntries(direct.map((name) => [name, fileDeps[name]])),
    pnpm: { overrides: fileDeps },
  };
  writeFileSync(join(scratchDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  execFileSync('pnpm', ['install', '--ignore-scripts', '--prefer-offline'], {
    cwd: scratchDir,
    stdio: 'pipe',
    env: { ...process.env, npm_config_update_notifier: 'false' },
  });
}

/**
 * Run a Node ES module inside the scratch project, where the packed shells
 * resolve like any published dependency (exports maps included). Throws with
 * the child's output on failure.
 */
export function runInScratch(scratchDir: string, scriptSource: string): string {
  const file = join(scratchDir, `check-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(file, scriptSource);
  try {
    return execFileSync(process.execPath, [file], { cwd: scratchDir, encoding: 'utf8' });
  } catch (error) {
    if (error instanceof Error && 'stderr' in error) {
      throw new ShellTestError(`scratch script failed:\n${String(error.stderr)}`);
    }
    throw error;
  }
}

/**
 * All import subpaths of an installed package: the exports-map keys minus
 * `./package.json` and minus `./bin/*`, which exist so a facade can forward
 * a command and run the program when imported.
 */
export function importSubpaths(installedPackageDir: string): string[] {
  const manifest: unknown = JSON.parse(
    readFileSync(join(installedPackageDir, 'package.json'), 'utf8'),
  );
  if (typeof manifest !== 'object' || manifest === null || !('exports' in manifest)) {
    throw new ShellTestError(`${installedPackageDir}/package.json has no exports`);
  }
  return Object.keys(Object(manifest.exports)).filter(
    (key) => key !== './package.json' && !key.startsWith('./bin/'),
  );
}

/**
 * Scan an installed shell's dist for import specifiers of internal workspace
 * packages. Returns offending `file: specifier` strings; the published shells
 * must never reference `@prisma-next/*`.
 */
export async function findInternalSpecifiers(installedPackageDir: string): Promise<string[]> {
  await initLexer;
  const offenders: string[] = [];
  const distDir = join(installedPackageDir, 'dist');
  for (const file of walk(distDir)) {
    if (file.endsWith('.mjs')) {
      const [imports] = parseModule(readFileSync(file, 'utf8'));
      for (const record of imports) {
        if (record.n?.startsWith('@prisma-next/')) offenders.push(`${file}: ${record.n}`);
      }
    } else if (file.endsWith('.d.mts')) {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (/^\s*(\*|\/\/)/.test(line)) continue;
        for (const match of line.matchAll(
          /(?:from\s+|^\s*import\s+|import\()(["'])(@prisma-next\/[^"']+)\1/g,
        )) {
          offenders.push(`${file}: ${match[2]}`);
        }
      }
    }
  }
  return offenders;
}

/**
 * Workspace source paths bundled into an installed package, read from its
 * sourcemaps, excluding the shell's own generated entry stubs. A shell must
 * only ever bundle the internal packages mapped to it — anything else is a
 * second copy of a module that another published package already owns.
 */
export function bundledSources(installedPackageDir: string): string[] {
  const sources = new Set<string>();
  for (const file of walk(join(installedPackageDir, 'dist'))) {
    if (!file.endsWith('.mjs.map')) continue;
    const map: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (typeof map !== 'object' || map === null || !('sources' in map)) continue;
    for (const source of Object(map).sources as unknown[]) {
      if (typeof source !== 'string') continue;
      const path = source.replace(/^(?:\.\.\/)+/, '');
      if (!path.startsWith('src-gen/')) sources.add(path);
    }
  }
  return [...sources].sort();
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}
