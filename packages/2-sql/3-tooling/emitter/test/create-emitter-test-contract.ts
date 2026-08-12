import {
  type Contract,
  type ContractModelBase,
  type ContractValueObject,
  profileHash,
  UNBOUND_DOMAIN_NAMESPACE_ID,
} from '@internal/contract/types';
import { applicationDomainOf } from '@repo/test-utils';
import { normalizeRootSqlStorage } from './sql-storage-fixture';

export function createEmitterTestContract(
  overrides: Partial<Omit<Contract, 'storage'>> & {
    models?: Record<string, ContractModelBase> | undefined;
    valueObjects?: Record<string, ContractValueObject> | undefined;
    storage?: Record<string, unknown> | undefined;
  } = {},
): Contract {
  const { models, domain, storage, valueObjects, ...rest } = overrides;
  const resolvedStorage = Object.hasOwn(overrides, 'storage')
    ? normalizeRootSqlStorage(storage)
    : normalizeRootSqlStorage({ tables: {} });
  const contract: Contract = {
    targetFamily: 'sql',
    target: 'test-db',
    roots: {},
    domain:
      domain ??
      applicationDomainOf({
        models: models ?? {},
        ...(valueObjects !== undefined ? { valueObjects } : {}),
        namespaceId: UNBOUND_DOMAIN_NAMESPACE_ID,
      }),
    extensions: {},
    capabilities: {},
    meta: {},
    profileHash: profileHash('test'),
    ...rest,
    storage: resolvedStorage as Contract['storage'],
  };
  for (const [namespaceId, ns] of Object.entries(contract.domain.namespaces)) {
    for (const model of Object.values(ns.models ?? {})) {
      const storage = model.storage;
      if (
        storage !== null &&
        typeof storage === 'object' &&
        !Array.isArray(storage) &&
        !('namespaceId' in storage)
      ) {
        Object.assign(storage, { namespaceId });
      }
    }
  }
  return contract;
}
