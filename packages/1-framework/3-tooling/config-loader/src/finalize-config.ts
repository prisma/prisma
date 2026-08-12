import type { PrismaNextConfig } from '@internal/config/config-types';
import { normalizeContractConfig } from '@internal/config/config-types';
import { resolve } from 'pathe';

type ContractSourceProvider = NonNullable<PrismaNextConfig['contract']>['source'];

function finalizeContractSource(
  source: ContractSourceProvider,
  configDir: string,
): ContractSourceProvider {
  const resolvedInputs = source.inputs?.map((input) => resolve(configDir, input));
  if (resolvedInputs === undefined) {
    return source;
  }

  return {
    ...source,
    inputs: resolvedInputs,
  };
}

type ContractConfig = NonNullable<PrismaNextConfig['contract']>;

/** Normalizes a contract section and resolves its paths against `configDir`. */
export function finalizeContractConfig(
  contract: ContractConfig,
  configDir: string,
): ContractConfig {
  const normalized = normalizeContractConfig(contract);
  return {
    ...normalized,
    source: finalizeContractSource(normalized.source, configDir),
    output: resolve(configDir, normalized.output),
  };
}

const DEFAULT_MIGRATIONS_DIR = 'migrations';

type MigrationsConfig = NonNullable<PrismaNextConfig['migrations']>;

/**
 * Resolves the migrations directory against `configDir`, which is what `migrations.dir` is
 * documented to be relative to. The default is applied here too, so no caller re-derives it
 * against a different base — a command run from one directory with `--config` naming a project in
 * another would otherwise read the wrong `migrations/`.
 */
export function finalizeMigrationsConfig(
  migrations: PrismaNextConfig['migrations'],
  configDir: string,
): MigrationsConfig & { readonly dir: string } {
  return {
    ...migrations,
    dir: resolve(configDir, migrations?.dir ?? DEFAULT_MIGRATIONS_DIR),
  };
}

export function finalizeConfig(config: PrismaNextConfig, configDir: string): PrismaNextConfig {
  return {
    ...config,
    ...(config.contract
      ? { contract: finalizeContractConfig(config.contract, configDir) }
      : undefined),
    migrations: finalizeMigrationsConfig(config.migrations, configDir),
  };
}
