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

export function finalizeConfig(config: PrismaNextConfig, configDir: string): PrismaNextConfig {
  if (!config.contract) {
    return config;
  }
  return {
    ...config,
    contract: finalizeContractConfig(config.contract, configDir),
  };
}
