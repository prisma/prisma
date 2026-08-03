import { freezeNode, IRNodeBase } from '@internal/framework-components/ir';
import type { MongoJsonObject, MongoWildcardProjection } from '../contract-types';
import { MongoCollationOptions, type MongoCollationOptionsInput } from './mongo-collation-options';

/**
 * Authoring / hydration input shape for {@link MongoIndexOptions}. Carries
 * the index option vocabulary as plain data without the IR-class `kind`
 * discriminator. `collation` accepts either a class instance or its own
 * input shape — the constructor normalises to the class form internally.
 */
export interface MongoIndexOptionsInput {
  readonly unique?: boolean;
  readonly name?: string;
  readonly partialFilterExpression?: MongoJsonObject;
  readonly sparse?: boolean;
  readonly expireAfterSeconds?: number;
  readonly weights?: Readonly<Record<string, number>>;
  readonly default_language?: string;
  readonly language_override?: string;
  readonly textIndexVersion?: number;
  readonly '2dsphereIndexVersion'?: number;
  readonly bits?: number;
  readonly min?: number;
  readonly max?: number;
  readonly bucketSize?: number;
  readonly hidden?: boolean;
  readonly collation?: MongoCollationOptions | MongoCollationOptionsInput;
  readonly wildcardProjection?: MongoWildcardProjection;
}

/**
 * Mongo Contract IR node for the per-index option vocabulary (the second
 * argument to `db.collection.createIndex(keys, options)` minus the keys
 * themselves). Lifted from a `type =` data shape to an AST class
 * extending `IRNodeBase` per FR18.
 *
 * Nested `collation` is itself an IR class (`MongoCollationOptions`); the
 * constructor accepts either a class instance or a data literal and
 * normalises to the class form so downstream walks see a uniform IR tree.
 */
export class MongoIndexOptions extends IRNodeBase {
  readonly kind = 'mongo-index-options' as const;
  declare readonly unique?: boolean;
  declare readonly name?: string;
  declare readonly partialFilterExpression?: MongoJsonObject;
  declare readonly sparse?: boolean;
  declare readonly expireAfterSeconds?: number;
  declare readonly weights?: Readonly<Record<string, number>>;
  declare readonly default_language?: string;
  declare readonly language_override?: string;
  declare readonly textIndexVersion?: number;
  declare readonly '2dsphereIndexVersion'?: number;
  declare readonly bits?: number;
  declare readonly min?: number;
  declare readonly max?: number;
  declare readonly bucketSize?: number;
  declare readonly hidden?: boolean;
  declare readonly collation?: MongoCollationOptions;
  declare readonly wildcardProjection?: MongoWildcardProjection;

  constructor(options: MongoIndexOptionsInput = {}) {
    super();
    if (options.unique !== undefined) this.unique = options.unique;
    if (options.name !== undefined) this.name = options.name;
    if (options.partialFilterExpression !== undefined)
      this.partialFilterExpression = options.partialFilterExpression;
    if (options.sparse !== undefined) this.sparse = options.sparse;
    if (options.expireAfterSeconds !== undefined)
      this.expireAfterSeconds = options.expireAfterSeconds;
    if (options.weights !== undefined) this.weights = options.weights;
    if (options.default_language !== undefined) this.default_language = options.default_language;
    if (options.language_override !== undefined) this.language_override = options.language_override;
    if (options.textIndexVersion !== undefined) this.textIndexVersion = options.textIndexVersion;
    if (options['2dsphereIndexVersion'] !== undefined)
      this['2dsphereIndexVersion'] = options['2dsphereIndexVersion'];
    if (options.bits !== undefined) this.bits = options.bits;
    if (options.min !== undefined) this.min = options.min;
    if (options.max !== undefined) this.max = options.max;
    if (options.bucketSize !== undefined) this.bucketSize = options.bucketSize;
    if (options.hidden !== undefined) this.hidden = options.hidden;
    if (options.collation !== undefined) {
      this.collation =
        options.collation instanceof MongoCollationOptions
          ? options.collation
          : new MongoCollationOptions(options.collation);
    }
    if (options.wildcardProjection !== undefined)
      this.wildcardProjection = options.wildcardProjection;
    freezeNode(this);
  }
}
