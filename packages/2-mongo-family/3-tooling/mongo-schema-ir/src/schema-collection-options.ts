import { freezeNode } from '@internal/framework-components/ir';
import type { CollationOptions } from '@internal/mongo-value/mongodb-types';
import { MongoSchemaIRNode } from './schema-node';
import type { MongoSchemaVisitor } from './visitor';

export interface MongoSchemaCollectionOptionsInput {
  readonly capped?: { size: number; max?: number };
  readonly timeseries?: {
    timeField: string;
    metaField?: string;
    granularity?: 'seconds' | 'minutes' | 'hours';
  };
  readonly collation?: CollationOptions;
  readonly changeStreamPreAndPostImages?: { enabled: boolean };
  readonly clusteredIndex?: { name?: string };
}

export class MongoSchemaCollectionOptions extends MongoSchemaIRNode {
  readonly nodeKind = 'collectionOptions' as const;
  /** Fixed sentinel: at most one options node exists per collection. */
  readonly id = 'options';
  readonly capped?: { size: number; max?: number } | undefined;
  readonly timeseries?:
    | { timeField: string; metaField?: string; granularity?: 'seconds' | 'minutes' | 'hours' }
    | undefined;
  readonly collation?: CollationOptions | undefined;
  readonly changeStreamPreAndPostImages?: { enabled: boolean } | undefined;
  readonly clusteredIndex?: { name?: string } | undefined;

  constructor(options: MongoSchemaCollectionOptionsInput) {
    super();
    this.capped = options.capped;
    this.timeseries = options.timeseries;
    this.collation = options.collation;
    this.changeStreamPreAndPostImages = options.changeStreamPreAndPostImages;
    this.clusteredIndex = options.clusteredIndex;
    freezeNode(this);
  }

  accept<R>(visitor: MongoSchemaVisitor<R>): R {
    return visitor.collectionOptions(this);
  }
}
