import { asNamespaceId } from '@internal/contract/types';
import { describe, expect, it } from 'vitest';
import {
  castColumnMeta,
  castColumnOf,
  unconvertedFieldOf,
} from '../src/core/migrations/unconverted-field';
import { contractOf } from './statement-fixtures';

const contract = contractOf({
  User: { table: 'user', fields: { id: 'id', age: 'age_years' } },
  Post: { table: 'post', fields: { id: 'id' } },
});

const step = (meta?: Record<string, unknown>) => ({
  description: 'alter type of "age_years"',
  sql: 'ALTER TABLE …',
  ...(meta === undefined ? {} : { meta }),
});

describe('unconvertedFieldOf', () => {
  it('names the field that stores the column a cast step converts', () => {
    expect(unconvertedFieldOf(step(castColumnMeta('user', 'age_years')), contract)).toEqual({
      kind: 'field',
      namespaceId: asNamespaceId('app'),
      model: 'User',
      field: 'age',
    });
  });

  it('names nothing for a step that casts no column, or a column no field stores', () => {
    expect([
      unconvertedFieldOf(step(), contract),
      unconvertedFieldOf(step({ warning: 'TABLE_REWRITE' }), contract),
      unconvertedFieldOf(step(castColumnMeta('user', 'gone')), contract),
      unconvertedFieldOf(step(castColumnMeta('other', 'id')), contract),
    ]).toEqual([undefined, undefined, undefined, undefined]);
  });

  it('names nothing when tables of two namespaces share the name', () => {
    const twoNamespaces = contractOf({
      User: { table: 'user', fields: { age: 'age' } },
      Member: { table: 'user', namespace: 'auth', fields: { age: 'age' } },
    });
    expect(unconvertedFieldOf(step(castColumnMeta('user', 'age')), twoNamespaces)).toBeUndefined();
  });
});

describe('castColumnOf', () => {
  it('reads the column a step casts, and nothing from other meta', () => {
    expect([
      castColumnOf(step(castColumnMeta('user', 'age'))),
      castColumnOf(step({ warning: 'TABLE_REWRITE' })),
      castColumnOf(step()),
    ]).toEqual([{ table: 'user', column: 'age' }, undefined, undefined]);
  });
});
