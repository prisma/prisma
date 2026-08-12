import type { Contract } from './contract-types';
import type { ControlPolicy } from './control-policy';

export function applySpecifierDefaultControlPolicy(
  contract: Contract,
  specifierDefault: ControlPolicy | undefined,
): Contract {
  if (specifierDefault === undefined || contract.defaultControlPolicy !== undefined) {
    return contract;
  }
  return { ...contract, defaultControlPolicy: specifierDefault };
}
