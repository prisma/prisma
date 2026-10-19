import type { MongoWhereFilter } from '@internal/mongo-orm';
import { describe, expect, it } from 'vitest';
import { timeouts, withMongoPort } from '../../_harness/mongo';
import type { Contract } from './_fixture/generated/contract';
import contractJson from './_fixture/generated/contract.json' with { type: 'json' };

const documents = [
  { name: 'missing', strings: ['a'], nullableStrings: ['a'] },
  {
    name: 'null',
    nickname: null,
    strings: [],
    nullableStrings: [],
    optionalStrings: null,
    optionalNullableStrings: null,
  },
  {
    name: 'empty',
    nickname: 'e',
    strings: [],
    nullableStrings: [],
    optionalStrings: [],
    optionalNullableStrings: [],
  },
  {
    name: 'pair',
    nickname: 'p',
    strings: ['a', 'b'],
    nullableStrings: ['a', null],
    optionalStrings: ['a', 'b'],
    optionalNullableStrings: ['b'],
  },
  {
    name: 'holdsNull',
    nickname: 'h',
    strings: ['c'],
    nullableStrings: [null],
    optionalStrings: ['c'],
    optionalNullableStrings: ['c', null],
  },
];

const cases: ReadonlyArray<{
  readonly filter: MongoWhereFilter<Contract, 'Lists'>;
  readonly names: readonly string[];
}> = [
  { filter: { strings: ['a', 'b'] }, names: ['pair'] },
  { filter: { strings: [] }, names: ['empty', 'null'] },
  { filter: { strings: 'a' }, names: ['missing', 'pair'] },
  { filter: { nullableStrings: ['a', null] }, names: ['pair'] },
  { filter: { nullableStrings: [null] }, names: ['holdsNull'] },
  { filter: { nullableStrings: 'a' }, names: ['missing', 'pair'] },
  { filter: { optionalStrings: null }, names: ['missing', 'null'] },
  { filter: { optionalStrings: [] }, names: ['empty'] },
  { filter: { optionalStrings: ['a', 'b'] }, names: ['pair'] },
  { filter: { optionalStrings: 'b' }, names: ['pair'] },
  { filter: { optionalNullableStrings: ['c', null] }, names: ['holdsNull'] },
  { filter: { optionalNullableStrings: [] }, names: ['empty'] },
  { filter: { optionalNullableStrings: 'b' }, names: ['pair'] },
  { filter: { optionalNullableStrings: null }, names: ['missing', 'null'] },
  { filter: { nickname: null }, names: ['missing', 'null'] },
  { filter: { nickname: 'p' }, names: ['pair'] },
];

describe('Mongo where on scalar list fields', () => {
  it(
    'matches a whole list exactly, one element by containment, and null on a nullable field as null or missing',
    () =>
      withMongoPort<Contract>({ contractJson }, async ({ db, mongoDb }) => {
        await mongoDb
          .collection('lists')
          .insertMany(documents.map((document) => ({ ...document })));

        const results = [];
        for (const { filter } of cases) {
          const rows = await db.lists.where(filter).select('name').orderBy({ name: 1 }).all();
          results.push({ filter, rows });
        }

        expect(results).toEqual(
          cases.map(({ filter, names }) => ({ filter, rows: names.map((name) => ({ name })) })),
        );
      }),
    timeouts.spinUpMongoMemoryServer,
  );
});
