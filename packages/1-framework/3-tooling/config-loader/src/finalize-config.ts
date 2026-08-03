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

export function finalizeConfig(config: PrismaNextConfig, configDir: string): PrismaNextConfig {
  if (!config.contract) {
    return config;
  }
  const contract = normalizeContractConfig(config.contract);
  const source = finalizeContractSource(contract.source, configDir);
  const output = resolve(configDir, contract.output);

  return {
    ...config,
    contract: {
      ...contract,
      source,
      output,
    },
  };
}
