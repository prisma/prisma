import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  indexLookupKey,
  MONGO_INDEX_OPTION_KEYS,
  type MongoIndexOptionKey,
} from '../src/index-equivalence';
import { MongoSchemaIndex, type MongoSchemaIndexOptions } from '../src/schema-index';

const keys = [{ field: 'email', direction: 1 as const }];

describe('MONGO_INDEX_OPTION_KEYS', () => {
  it('lists every index option', () => {
    expectTypeOf<MongoIndexOptionKey>().toEqualTypeOf<
      Exclude<keyof MongoSchemaIndexOptions, 'keys'>
    >();
    expect(MONGO_INDEX_OPTION_KEYS).toHaveLength(9);
  });
});

describe('indexLookupKey', () => {
  it('tells apart indexes that differ in any option, and ignores options set to false', () => {
    const lookupKey = (options: Omit<MongoSchemaIndexOptions, 'keys'>) =>
      indexLookupKey(new MongoSchemaIndex({ keys, ...options }));

    expect({
      plain: lookupKey({}),
      notSparse: lookupKey({ sparse: false }),
      reordered:
        lookupKey({ collation: { locale: 'en', strength: 2 } }) ===
        lookupKey({ collation: { strength: 2, locale: 'en' } }),
      distinct: new Set(
        [
          {},
          { unique: true },
          { sparse: true },
          { expireAfterSeconds: 0 },
          { partialFilterExpression: { a: 1 } },
          { wildcardProjection: { a: 1 as const } },
          { collation: { locale: 'en' } },
          { weights: { a: 2 } },
          { default_language: 'french' },
          { language_override: 'lang' },
        ].map(lookupKey),
      ).size,
    }).toEqual({ plain: 'email:1', notSparse: 'email:1', reordered: true, distinct: 10 });
  });
});
