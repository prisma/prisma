import { freezeNode, IRNodeBase } from '@internal/framework-components/ir';

export type MongoClusteredCollectionKey = Readonly<Record<string, 1>>;

export interface MongoClusteredCollectionOptionsInput {
  readonly name?: string;
  readonly key: MongoClusteredCollectionKey;
  readonly unique: boolean;
}

/**
 * Clustered-collection options (the `clusteredIndex` collection-creation
 * field). Lifted from a `type =` data shape to an AST class extending
 * `IRNodeBase` per FR18.
 *
 * MongoDB requires `key` and `unique` for any clustered collection; the
 * constructor enforces presence by type signature.
 */
export class MongoClusteredCollectionOptions extends IRNodeBase {
  readonly kind = 'mongo-clustered-collection-options' as const;
  declare readonly name?: string;
  readonly key: MongoClusteredCollectionKey;
  readonly unique: boolean;

  constructor(options: MongoClusteredCollectionOptionsInput) {
    super();
    if (options.name !== undefined) this.name = options.name;
    this.key = options.key;
    this.unique = options.unique;
    freezeNode(this);
  }
}
