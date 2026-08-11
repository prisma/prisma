import type { PrismaNextConfig } from '@internal/config/config-types';
import { APP_SPACE_ID } from '@internal/framework-components/control';
import { spaceMigrationDirectory } from '@internal/migration-tools/spaces';
import { resolve } from 'pathe';

/**
 * Where migrations live for this project. Resolved against the invocation
 * directory, which is also the config file's directory for every default
 * invocation.
 */
export function migrationsDirFor(config: PrismaNextConfig, cwd: string): string {
  return resolve(cwd, config.migrations?.dir ?? 'migrations');
}

/** The app subspace under {@link migrationsDirFor}. */
export function appMigrationsDirFor(config: PrismaNextConfig, cwd: string): string {
  return spaceMigrationDirectory(migrationsDirFor(config, cwd), APP_SPACE_ID);
}

/**
 * The emitted contract. The config loader has already resolved
 * `contract.output` against the config file's directory, so this only has an
 * effect for a config handed in raw, as tests do.
 */
export function contractPathFor(config: PrismaNextConfig, cwd: string): string | undefined {
  const output = config.contract?.output;
  return output === undefined ? undefined : resolve(cwd, output);
}
