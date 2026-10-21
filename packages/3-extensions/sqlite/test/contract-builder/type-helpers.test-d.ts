import { expectTypeOf, test } from 'vitest';
import { defineContract } from '../../src/exports/contract-builder';

test('type.* has a helper for every SQLite PSL type constructor and no Postgres one', () => {
  defineContract({}, ({ type }) => {
    expectTypeOf(type.DateTime().codecId).toEqualTypeOf<'sqlite/datetime@1'>();
    expectTypeOf(type).not.toHaveProperty('Timestamptz');
    return { models: {} };
  });
});
