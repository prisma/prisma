import type { MongoValue } from '@internal/mongo-value';
import { MongoAstNode } from './ast-node';
import type { MongoFilterExpr } from './filter-expressions';
import type { RawMongoCommand } from './raw-commands';
import type { MongoPipelineStage, MongoUpdatePipelineStage } from './stages';
export type MongoUpdateSpec = Record<string, MongoValue> | ReadonlyArray<MongoUpdatePipelineStage>;

export class InsertOneCommand extends MongoAstNode {
  readonly kind = 'insertOne' as const;
  readonly collection: string;
  readonly document: Record<string, MongoValue>;

  constructor(collection: string, document: Record<string, MongoValue>) {
    super();
    this.collection = collection;
    this.document = document;
    this.freeze();
  }
}

export class UpdateOneCommand extends MongoAstNode {
  readonly kind = 'updateOne' as const;
  readonly collection: string;
  readonly filter: MongoFilterExpr;
  readonly update: MongoUpdateSpec;
  /**
   * When true, the wire command becomes an upsert: if no document matches
   * `filter`, a new document is inserted, derived from the filter's
   * equality fields plus the update spec. Defaults to false.
   */
  readonly upsert: boolean;

  constructor(
    collection: string,
    filter: MongoFilterExpr,
    update: MongoUpdateSpec,
    upsert = false,
  ) {
    super();
    this.collection = collection;
    this.filter = filter;
    this.update = update;
    this.upsert = upsert;
    this.freeze();
  }
}

export class DeleteOneCommand extends MongoAstNode {
  readonly kind = 'deleteOne' as const;
  readonly collection: string;
  readonly filter: MongoFilterExpr;

  constructor(collection: string, filter: MongoFilterExpr) {
    super();
    this.collection = collection;
    this.filter = filter;
    this.freeze();
  }
}

export class InsertManyCommand extends MongoAstNode {
  readonly kind = 'insertMany' as const;
  readonly collection: string;
  readonly documents: ReadonlyArray<Record<string, MongoValue>>;

  constructor(collection: string, documents: ReadonlyArray<Record<string, MongoValue>>) {
    super();
    this.collection = collection;
    this.documents = documents;
    this.freeze();
  }
}

export class UpdateManyCommand extends MongoAstNode {
  readonly kind = 'updateMany' as const;
  readonly collection: string;
  readonly filter: MongoFilterExpr;
  readonly update: MongoUpdateSpec;
  /**
   * Upsert flag — see `UpdateOneCommand.upsert`. For `updateMany`, Mongo
   * inserts at most one document when no match exists (driver-side
   * constraint).
   */
  readonly upsert: boolean;

  constructor(
    collection: string,
    filter: MongoFilterExpr,
    update: MongoUpdateSpec,
    upsert = false,
  ) {
    super();
    this.collection = collection;
    this.filter = filter;
    this.update = update;
    this.upsert = upsert;
    this.freeze();
  }
}

export class DeleteManyCommand extends MongoAstNode {
  readonly kind = 'deleteMany' as const;
  readonly collection: string;
  readonly filter: MongoFilterExpr;

  constructor(collection: string, filter: MongoFilterExpr) {
    super();
    this.collection = collection;
    this.filter = filter;
    this.freeze();
  }
}

export class FindOneAndUpdateCommand extends MongoAstNode {
  readonly kind = 'findOneAndUpdate' as const;
  readonly collection: string;
  readonly filter: MongoFilterExpr;
  readonly update: MongoUpdateSpec;
  readonly upsert: boolean;
  readonly sort: Record<string, 1 | -1> | undefined;
  readonly returnDocument: 'before' | 'after';

  constructor(
    collection: string,
    filter: MongoFilterExpr,
    update: MongoUpdateSpec,
    upsert = false,
    sort?: Record<string, 1 | -1>,
    returnDocument: 'before' | 'after' = 'after',
  ) {
    super();
    this.collection = collection;
    this.filter = filter;
    this.update = update;
    this.upsert = upsert;
    this.sort = sort;
    this.returnDocument = returnDocument;
    this.freeze();
  }
}

export class FindOneAndDeleteCommand extends MongoAstNode {
  readonly kind = 'findOneAndDelete' as const;
  readonly collection: string;
  readonly filter: MongoFilterExpr;
  readonly sort: Record<string, 1 | -1> | undefined;

  constructor(collection: string, filter: MongoFilterExpr, sort?: Record<string, 1 | -1>) {
    super();
    this.collection = collection;
    this.filter = filter;
    this.sort = sort;
    this.freeze();
  }
}

export class AggregateCommand extends MongoAstNode {
  readonly kind = 'aggregate' as const;
  readonly collection: string;
  readonly pipeline: ReadonlyArray<MongoPipelineStage>;

  constructor(collection: string, pipeline: ReadonlyArray<MongoPipelineStage>) {
    super();
    this.collection = collection;
    this.pipeline = pipeline;
    this.freeze();
  }
}

export type AnyMongoCommand =
  | InsertOneCommand
  | InsertManyCommand
  | UpdateOneCommand
  | UpdateManyCommand
  | DeleteOneCommand
  | DeleteManyCommand
  | FindOneAndUpdateCommand
  | FindOneAndDeleteCommand
  | AggregateCommand
  | RawMongoCommand;
