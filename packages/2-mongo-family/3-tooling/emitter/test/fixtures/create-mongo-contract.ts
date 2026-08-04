import {
  type Contract,
  type ContractModelBase,
  type ContractValueObject,
  coreHash,
  UNBOUND_DOMAIN_NAMESPACE_ID,
} from '@internal/contract/types';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { applicationDomainOf } from '@repo/test-utils';

export function namespacedMongoStorageFromCollections(
  collections: Record<string, unknown>,
  storageHash = 'test',
) {
  return {
    storageHash: coreHash(storageHash),
    namespaces: {
      [UNBOUND_NAMESPACE_ID]: {
        id: UNBOUND_NAMESPACE_ID,
        kind: 'mongo-namespace' as const,
        entries: { collection: collections },
      },
    },
  } as Contract['storage'];
}

export function createMongoContract(
  overrides: Partial<Contract> & {
    models?: Record<string, ContractModelBase>;
    valueObjects?: Record<string, ContractValueObject>;
  } = {},
): Contract {
  const { models, domain, valueObjects, ...rest } = overrides;
  return {
    targetFamily: 'mongo' as const,
    target: 'mongo',
    domain:
      domain ??
      applicationDomainOf({
        models: models ?? {},
        ...(valueObjects !== undefined ? { valueObjects } : {}),
        namespaceId: UNBOUND_DOMAIN_NAMESPACE_ID,
      }),
    storage: namespacedMongoStorageFromCollections({}) as Contract['storage'],
    extensions: {},
    capabilities: {},
    meta: {},
    roots: {},
    profileHash: 'test' as const,
    ...rest,
  } as Contract;
}
