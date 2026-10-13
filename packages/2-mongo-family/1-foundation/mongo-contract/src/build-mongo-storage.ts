import { computeStorageHash } from '@internal/contract/hashing';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { mongoContractCanonicalizationHooks } from './canonicalization-hooks';
import { buildMongoNamespace } from './ir/build-mongo-namespace';
import type { MongoCollectionInput } from './ir/mongo-collection';
import { MongoStorage } from './ir/mongo-storage';
import type { MongoValueSetInput } from './ir/mongo-value-set';

/**
 * Builds a Mongo contract's storage: the unbound namespace holding the collections and value sets, and the storage hash that `db sign` and `db verify` compare. Every Mongo contract source calls this, so they hash storage the same way.
 */
export function buildMongoStorage(input: {
  readonly collections: Readonly<Record<string, MongoCollectionInput>>;
  readonly valueSets: Readonly<Record<string, MongoValueSetInput>>;
}): MongoStorage {
  const hasValueSets = Object.keys(input.valueSets).length > 0;
  const namespace = buildMongoNamespace({
    id: UNBOUND_NAMESPACE_ID,
    entries: {
      collection: input.collections,
      ...(hasValueSets ? { valueSet: input.valueSets } : {}),
    },
  });
  const storageHash = computeStorageHash({
    target: 'mongo',
    targetFamily: 'mongo',
    storage: {
      namespaces: {
        [UNBOUND_NAMESPACE_ID]: {
          id: UNBOUND_NAMESPACE_ID,
          entries: {
            collection: namespace.entries.collection,
            ...(namespace.entries.valueSet !== undefined
              ? { valueSet: namespace.entries.valueSet }
              : {}),
          },
        },
      },
    },
    ...mongoContractCanonicalizationHooks,
  });
  return new MongoStorage({ storageHash, namespaces: { [UNBOUND_NAMESPACE_ID]: namespace } });
}
