import {
  freezeNode,
  hydrateNamespaceEntities,
  NamespaceBase,
  UNBOUND_NAMESPACE_ID,
} from '@internal/framework-components/ir';
import { blindCast } from '@internal/utils/casts';
import { composeMongoEntityKinds } from '../entity-kinds';
import type { MongoCollection } from './mongo-collection';
import type {
  MongoNamespace,
  MongoNamespaceCollectionsInput,
  MongoNamespaceEntries,
} from './mongo-storage';
import { MongoUnboundNamespace } from './mongo-unbound-namespace';

const MONGO_NAMESPACE_KIND = 'mongo-namespace' as const;

class MongoBoundNamespace extends NamespaceBase {
  declare readonly kind: string;

  readonly id: string;
  readonly entries: MongoNamespaceEntries;

  static fromCollectionsInput(input: MongoNamespaceCollectionsInput): MongoNamespace {
    const collectionMap = input.entries['collection'];
    const collectionCount = collectionMap !== undefined ? Object.keys(collectionMap).length : 0;
    const hasUnknownKinds = Object.keys(input.entries).some((kind) => kind !== 'collection');
    if (input.id === UNBOUND_NAMESPACE_ID && collectionCount === 0 && !hasUnknownKinds) {
      return MongoUnboundNamespace.instance;
    }
    return new MongoBoundNamespace(input);
  }

  private constructor(input: MongoNamespaceCollectionsInput) {
    super();
    this.id = input.id;

    const rawEntries: Record<string, Readonly<Record<string, unknown>>> = {
      collection: {},
      ...input.entries,
    };
    this.entries = Object.freeze(
      blindCast<
        MongoNamespaceEntries,
        'composeMongoEntityKinds() supplies the collection→MongoCollection descriptor, so this open-dict result holds the typed collection member MongoNamespaceEntries declares; the descriptor Map erases that per-kind Node type from the return.'
      >(hydrateNamespaceEntities(rawEntries, composeMongoEntityKinds(), 'carry')),
    );
    Object.defineProperty(this, 'kind', {
      value: MONGO_NAMESPACE_KIND,
      writable: false,
      enumerable: false,
      configurable: true,
    });
    freezeNode(this);
  }

  get collection(): Readonly<Record<string, MongoCollection>> {
    return this.entries.collection ?? Object.freeze({});
  }
}

export function buildMongoNamespace(input: MongoNamespaceCollectionsInput): MongoNamespace {
  return MongoBoundNamespace.fromCollectionsInput(input);
}
