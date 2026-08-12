import type { OnDiskMigrationPackage } from '@internal/migration-tools/package';
import { notOk, ok, type Result } from '@internal/utils/result';
import { isAbsolute, relative, resolve } from 'pathe';
import { type CliStructuredError, errorRuntime } from './cli-errors';

export function looksLikePath(target: string): boolean {
  return target.includes('/') || target.includes('\\');
}

export function resolveAppTargetPath(
  cwd: string,
  target: string,
  appMigrationsDir: string,
  appMigrationsRelative: string,
): Result<string, CliStructuredError> {
  const targetPath = resolve(cwd, target);
  const relativeToApp = relative(appMigrationsDir, targetPath);
  const isOutsideAppDir =
    relativeToApp === '' ||
    relativeToApp === '.' ||
    relativeToApp.startsWith('..') ||
    isAbsolute(relativeToApp);
  if (isOutsideAppDir) {
    return notOk(
      errorRuntime(
        'MIGRATION.TARGET_NOT_APP_SPACE',
        'Target must point to an app-space migration',
        {
          why: `Expected a path under ${appMigrationsRelative}, got ${target}`,
          fix: 'Pass an app-space migration directory or use a hash prefix.',
        },
      ),
    );
  }
  return ok(targetPath);
}

/**
 * Resolve a filesystem-path target to the migration dir that contains it,
 * searching each in-scope space's `migrationsDir`. A path is explicit, so
 * it can belong to at most one space — returns the first match, or `null`
 * when the path falls outside every space dir.
 */
export function resolveTargetPathAcrossSpaces(
  cwd: string,
  target: string,
  spaces: ReadonlyArray<{ readonly migrationsDir: string }>,
): string | null {
  const targetPath = resolve(cwd, target);
  for (const space of spaces) {
    const rel = relative(space.migrationsDir, targetPath);
    const isOutside = rel === '' || rel === '.' || rel.startsWith('..') || isAbsolute(rel);
    if (!isOutside) {
      return targetPath;
    }
  }
  return null;
}

export function findPackageByDirPath(
  packages: readonly OnDiskMigrationPackage[],
  resolvedDirPath: string,
): OnDiskMigrationPackage | undefined {
  const normalized = resolve(resolvedDirPath);
  return packages.find((p) => resolve(p.dirPath) === normalized);
}
