import { freezeNode, IRNodeBase } from '@internal/framework-components/ir';

export type MongoTimeSeriesGranularity = 'seconds' | 'minutes' | 'hours';

export interface MongoTimeSeriesCollectionOptionsInput {
  readonly timeField: string;
  readonly metaField?: string;
  readonly granularity?: MongoTimeSeriesGranularity;
  readonly bucketMaxSpanSeconds?: number;
  readonly bucketRoundingSeconds?: number;
}

/**
 * Time-series collection options. Lifted from a `type =` data shape to
 * an AST class extending `IRNodeBase` per FR18.
 *
 * MongoDB requires `timeField` for any time-series collection; the
 * constructor enforces presence by type signature (`timeField: string`
 * is required on the input).
 */
export class MongoTimeSeriesCollectionOptions extends IRNodeBase {
  readonly kind = 'mongo-time-series-collection-options' as const;
  readonly timeField: string;
  declare readonly metaField?: string;
  declare readonly granularity?: MongoTimeSeriesGranularity;
  declare readonly bucketMaxSpanSeconds?: number;
  declare readonly bucketRoundingSeconds?: number;

  constructor(options: MongoTimeSeriesCollectionOptionsInput) {
    super();
    this.timeField = options.timeField;
    if (options.metaField !== undefined) this.metaField = options.metaField;
    if (options.granularity !== undefined) this.granularity = options.granularity;
    if (options.bucketMaxSpanSeconds !== undefined)
      this.bucketMaxSpanSeconds = options.bucketMaxSpanSeconds;
    if (options.bucketRoundingSeconds !== undefined)
      this.bucketRoundingSeconds = options.bucketRoundingSeconds;
    freezeNode(this);
  }
}
