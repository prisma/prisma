import type { PlanMeta } from '@internal/contract/types';
import type { MongoQueryPlan } from '@internal/mongo-query-ast/execution';
import {
  RawAggregateCommand,
  RawDeleteManyCommand,
  RawDeleteOneCommand,
  RawFindOneAndDeleteCommand,
  RawFindOneAndUpdateCommand,
  RawInsertManyCommand,
  RawInsertOneCommand,
  RawUpdateManyCommand,
  RawUpdateOneCommand,
} from '@internal/mongo-query-ast/execution';
import type { Document } from '@internal/mongo-value';

interface Buildable<Row = unknown> {
  build(): MongoQueryPlan<Row>;
}

export interface RawMongoCollection {
  aggregate<Row = Record<string, unknown>>(pipeline: ReadonlyArray<Document>): Buildable<Row>;

  insertOne(document: Document): Buildable;
  insertMany(documents: ReadonlyArray<Document>): Buildable;

  updateOne(filter: Document, update: Document | ReadonlyArray<Document>): Buildable;

  updateMany(filter: Document, update: Document | ReadonlyArray<Document>): Buildable;

  deleteOne(filter: Document): Buildable;
  deleteMany(filter: Document): Buildable;

  findOneAndUpdate(
    filter: Document,
    update: Document | ReadonlyArray<Document>,
    options?: { upsert?: boolean },
  ): Buildable;

  findOneAndDelete(filter: Document): Buildable;
}

export function createRawMongoCollection(
  collectionName: string,
  meta: PlanMeta,
): RawMongoCollection {
  function buildable<Row>(command: MongoQueryPlan['command']): Buildable<Row> {
    return {
      build: () => ({ collection: collectionName, command, meta }),
    };
  }

  return {
    aggregate<Row = Record<string, unknown>>(pipeline: ReadonlyArray<Document>) {
      return buildable<Row>(new RawAggregateCommand(collectionName, pipeline));
    },

    insertOne(document: Document) {
      return buildable(new RawInsertOneCommand(collectionName, document));
    },

    insertMany(documents: ReadonlyArray<Document>) {
      return buildable(new RawInsertManyCommand(collectionName, documents));
    },

    updateOne(filter: Document, update: Document | ReadonlyArray<Document>) {
      return buildable(new RawUpdateOneCommand(collectionName, filter, update));
    },

    updateMany(filter: Document, update: Document | ReadonlyArray<Document>) {
      return buildable(new RawUpdateManyCommand(collectionName, filter, update));
    },

    deleteOne(filter: Document) {
      return buildable(new RawDeleteOneCommand(collectionName, filter));
    },

    deleteMany(filter: Document) {
      return buildable(new RawDeleteManyCommand(collectionName, filter));
    },

    findOneAndUpdate(
      filter: Document,
      update: Document | ReadonlyArray<Document>,
      options?: { upsert?: boolean },
    ) {
      return buildable(
        new RawFindOneAndUpdateCommand(collectionName, filter, update, options?.upsert ?? false),
      );
    },

    findOneAndDelete(filter: Document) {
      return buildable(new RawFindOneAndDeleteCommand(collectionName, filter));
    },
  };
}
