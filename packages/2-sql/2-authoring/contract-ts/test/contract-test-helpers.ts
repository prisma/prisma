import type { Contract, ContractValueObjectDefinitions } from '@internal/contract/types';
import {
  domainModelsAtDefaultNamespace,
  domainValueObjectsAtDefaultNamespace,
} from '@internal/contract/types';
import { blindCast } from '@internal/utils/casts';

/** Models map for the contract's sole domain namespace, precise per-namespace. */
type SoleNamespaceModels<T extends Contract> =
  T['domain']['namespaces'][keyof T['domain']['namespaces']]['models'];

export function modelsOf<T extends Contract>(contract: T): SoleNamespaceModels<T> {
  return domainModelsAtDefaultNamespace(contract.domain) as SoleNamespaceModels<T>;
}

export function valueObjectsOf<T extends Contract>(
  contract: T,
): ContractValueObjectDefinitions<T> | undefined {
  return domainValueObjectsAtDefaultNamespace(contract.domain) as
    | ContractValueObjectDefinitions<T>
    | undefined;
}

/** Flat model map for runtime assertions when model types are widened by the test harness. */
export type AssertionModelMap = Record<
  string,
  {
    readonly storage: {
      readonly table?: string;
      readonly fields: Record<string, unknown>;
    };
  }
>;

export function modelsMapForAssertions<T extends Contract>(contract: T): AssertionModelMap {
  return blindCast<AssertionModelMap, 'test assertions index models by string name'>(
    domainModelsAtDefaultNamespace(contract.domain),
  );
}
