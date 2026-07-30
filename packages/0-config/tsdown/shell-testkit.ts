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
 * Every shell is both a direct `file:` dependency and a pnpm override, so
 * cross-shell dependencies (exact lockstep versions that are not on the npm
 * registry yet) resolve to the local tarballs.
 */
export function installShells(scratchDir: string, shells: readonly PackedShell[]): void {
  mkdirSync(scratchDir, { recursive: true });
  const fileDeps = Object.fromEntries(shells.map((s) => [s.name, `file:${s.tarball}`]));
  const manifest = {
    name: 'shell-tarball-smoke',
    private: true,
    type: 'module',
    dependencies: fileDeps,
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

/** All import subpaths (exports-map keys minus `./package.json`) of an installed package. */
export function importSubpaths(installedPackageDir: string): string[] {
  const manifest: unknown = JSON.parse(
    readFileSync(join(installedPackageDir, 'package.json'), 'utf8'),
  );
  if (typeof manifest !== 'object' || manifest === null || !('exports' in manifest)) {
    throw new ShellTestError(`${installedPackageDir}/package.json has no exports`);
  }
  return Object.keys(Object(manifest.exports)).filter((key) => key !== './package.json');
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

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}
