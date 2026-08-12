import type {
  AnyEntityKindDescriptor,
  EntityKindDescriptor,
} from '@internal/framework-components/ir';
import { structuredError } from '@internal/utils/structured-error';
import { StorageCollectionSchema, StorageValueSetSchema } from './contract-schema';
import { MongoCollection, type MongoCollectionInput } from './ir/mongo-collection';
import { MongoValueSet, type MongoValueSetInput } from './ir/mongo-value-set';

export const collectionEntityKind: EntityKindDescriptor<MongoCollectionInput, MongoCollection> = {
  kind: 'collection',
  schema: StorageCollectionSchema,
  construct: (input) => new MongoCollection(input),
};

export const valueSetEntityKind: EntityKindDescriptor<MongoValueSetInput, MongoValueSet> = {
  kind: 'valueSet',
  schema: StorageValueSetSchema,
  construct: (input) => new MongoValueSet(input),
};

/**
 * Assembles the `kind → descriptor` registry for Mongo namespaces: the built-in
 * `collection` kind plus any target `packKinds`. This builds the lookup table —
 * it does not touch contract data. `hydrateNamespaceEntities` later consumes
 * this registry to turn a namespace's raw entries into IR instances. Throws on
 * a duplicate kind.
 */
export function composeMongoEntityKinds(
  packKinds: readonly AnyEntityKindDescriptor[] = [],
): ReadonlyMap<string, AnyEntityKindDescriptor> {
  const kinds = new Map<string, AnyEntityKindDescriptor>([
    ['collection', collectionEntityKind],
    ['valueSet', valueSetEntityKind],
  ]);
  for (const descriptor of packKinds) {
    if (kinds.has(descriptor.kind)) {
      throw structuredError(
        'CONTRACT.PACK_CONTRIBUTION_INVALID',
        `composeMongoEntityKinds: duplicate entity kind "${descriptor.kind}" — each kind may be registered only once`,
      );
    }
    kinds.set(descriptor.kind, descriptor);
  }
  return kinds;
}
