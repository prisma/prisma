import { describe, expect, it } from 'vitest';
import {
  requiredColumnMeta,
  requiredColumnOf,
  rowsWithoutValueSummary,
} from '../src/core/migrations/required-column';

const step = (meta?: Record<string, unknown>) => ({
  description: 'ensure no NULL values in "note"',
  sql: 'SELECT …',
  ...(meta === undefined ? {} : { meta }),
});

describe('requiredColumnOf', () => {
  it('reads the column a step checks before it becomes required, and nothing from other meta', () => {
    expect([
      requiredColumnOf(step(requiredColumnMeta('Item', 'note', 'nullValues'))),
      requiredColumnOf(step(requiredColumnMeta('User', 'code', 'newField'))),
      requiredColumnOf(step({ castColumn: { table: 'Item', column: 'note' } })),
      requiredColumnOf(step()),
    ]).toEqual([
      { table: 'Item', column: 'note', reason: 'nullValues' },
      { table: 'User', column: 'code', reason: 'newField' },
      undefined,
      undefined,
    ]);
  });
});

describe('rowsWithoutValueSummary', () => {
  it('counts the rows that hold NULL, or that a new required column has no value for', () => {
    expect([
      rowsWithoutValueSummary({ table: 'Item', column: 'note', reason: 'nullValues' }, 3),
      rowsWithoutValueSummary({ table: 'Item', column: 'note', reason: 'nullValues' }, 1),
      rowsWithoutValueSummary({ table: 'User', column: 'code', reason: 'newField' }, 2),
    ]).toEqual([
      '3 rows of "Item" hold NULL in "note", so it cannot become required.',
      '1 row of "Item" holds NULL in "note", so it cannot become required.',
      '"User" has 2 rows, so the new required column "code" cannot be added: it can be added to an empty table only.',
    ]);
  });
});
