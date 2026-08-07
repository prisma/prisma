import {
  MongoAndExpr,
  MongoExistsExpr,
  MongoFieldFilter,
  type MongoFilterExpr,
  MongoNotExpr,
} from '@internal/mongo-query-ast/execution';
import { describe, expect, it } from 'vitest';
import { type MongoPortContext, timeouts, withMongoPort } from '../../../../../_harness/mongo';
import type { Contract } from './_fixture/generated/contract';
import contractJson from './_fixture/generated/contract.json' with { type: 'json' };

const basicDocuments = [
  {
    _id: 1,
    top_a: [
      { a1: 'foo1', a_2: 1 },
      { a1: 'foo2', a_2: 10 },
      { a1: 'oof', a_2: 100 },
    ],
  },
  {
    _id: 2,
    top_a: [
      { a1: 'test1', a_2: 1 },
      { a1: 'test2', a_2: 10 },
      { a1: 'test3', a_2: 100 },
    ],
  },
  {
    _id: 3,
    top_a: [
      { a1: 'oof', a_2: 100 },
      { a1: 'ofo', a_2: 100 },
      { a1: 'oof', a_2: -10 },
    ],
  },
  {
    _id: 4,
    top_a: [
      { a1: 'test', a_2: -5 },
      { a1: 'Test', a_2: 0 },
    ],
  },
  { _id: 5, top_a: [{ a1: 'Test', a_2: 0 }] },
  { _id: 6, top_a: [] },
  { _id: 7, top_a: [] },
  { _id: 8 },
  { _id: 9 },
];

const nestedDocuments = [
  {
    _id: 1,
    top_a: [
      { a1: 'foo1', a_2: 1, a_to_many_bs: [{ b_field: 123 }, { b_field: 5 }] },
      { a1: 'foo2', a_2: 10, a_to_many_bs: [{ b_field: 321 }, { b_field: 5 }] },
      { a1: 'oof', a_2: 100, a_to_many_bs: [{ b_field: 111 }, { b_field: 50 }] },
    ],
  },
  {
    _id: 2,
    top_a: [
      { a1: 'test1', a_2: 1, a_to_many_bs: [{ b_field: 1 }, { b_field: 2 }] },
      { a1: 'test2', a_2: 10, a_to_many_bs: [{ b_field: 5 }, { b_field: 5 }] },
      { a1: 'test3', a_2: 100, a_to_many_bs: [{ b_field: 0 }, { b_field: -5 }] },
    ],
  },
  {
    _id: 3,
    top_a: [
      { a1: 'oof', a_2: 100, a_to_many_bs: [{ b_field: 0 }, { b_field: 0 }] },
      { a1: 'ofo', a_2: 100, a_to_many_bs: [{ b_field: -2 }, { b_field: 2 }] },
      { a1: 'oof', a_2: -10, a_to_many_bs: [{ b_field: 1 }, { b_field: 1 }] },
    ],
  },
  {
    _id: 4,
    top_a: [
      { a1: 'test', a_2: -5, a_to_many_bs: [{ b_field: 10 }, { b_field: 20 }] },
      { a1: 'Test', a_2: 0, a_to_many_bs: [{ b_field: 11 }, { b_field: 22 }] },
    ],
  },
  {
    _id: 5,
    top_a: [{ a1: 'Test', a_2: 0, a_to_many_bs: [{ b_field: 5 }, { b_field: 55 }] }],
  },
  { _id: 6, top_a: [] },
  { _id: 7, top_a: [] },
  { _id: 8 },
  { _id: 9 },
];

function withCompositeNone(
  documents: readonly Record<string, unknown>[],
  fn: Parameters<typeof withMongoPort<Contract>>[1],
) {
  return withMongoPort<Contract>({ contractJson }, async (ctx) => {
    await ctx.mongoDb
      .collection('TestModel')
      .insertMany(documents, { bypassDocumentValidation: true });
    await fn(ctx);
  });
}

async function queryIds(db: MongoPortContext<Contract>['db'], filter: MongoFilterExpr) {
  return db.TestModel.where(filter).select('_id').all();
}

const existingTopA = MongoExistsExpr.exists('top_a');
const anyTopA = MongoFieldFilter.of('top_a', '$elemMatch', {});

describe('ports/engines/queries/filters/composite/none', () => {
  it(
    'basic',
    () =>
      withCompositeNone(basicDocuments, async ({ db }) => {
        const hasNegative = MongoFieldFilter.of('top_a', '$elemMatch', { a_2: { $lt: 0 } });
        const result = await queryIds(
          db,
          MongoAndExpr.of([existingTopA, new MongoNotExpr(hasNegative)]),
        );
        expect(result).toEqual([{ _id: 1 }, { _id: 2 }, { _id: 5 }, { _id: 6 }, { _id: 7 }]);
      }),
    timeouts.spinUpMongoMemoryServer,
  );

  it(
    'empty',
    () =>
      withCompositeNone(basicDocuments, async ({ db }) => {
        const none = await queryIds(db, MongoAndExpr.of([existingTopA, new MongoNotExpr(anyTopA)]));
        expect(none).toEqual([{ _id: 6 }, { _id: 7 }]);

        const notNone = await queryIds(db, anyTopA);
        expect(notNone).toEqual([{ _id: 1 }, { _id: 2 }, { _id: 3 }, { _id: 4 }, { _id: 5 }]);
      }),
    timeouts.spinUpMongoMemoryServer,
  );

  it(
    'nested_none',
    () =>
      withCompositeNone(nestedDocuments, async ({ db }) => {
        const hasOuterElementWithNoPositiveInnerElement = MongoFieldFilter.of(
          'top_a',
          '$elemMatch',
          {
            a_to_many_bs: { $not: { $elemMatch: { b_field: { $gt: 0 } } } },
          },
        );
        const result = await queryIds(
          db,
          MongoAndExpr.of([
            existingTopA,
            new MongoNotExpr(hasOuterElementWithNoPositiveInnerElement),
          ]),
        );
        expect(result).toEqual([{ _id: 1 }, { _id: 4 }, { _id: 5 }, { _id: 6 }, { _id: 7 }]);
      }),
    timeouts.spinUpMongoMemoryServer,
  );
});
