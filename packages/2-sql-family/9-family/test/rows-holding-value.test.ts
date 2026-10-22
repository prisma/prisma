import { asNamespaceId } from '@internal/contract/types';
import { describe, expect, it } from 'vitest';
import {
  rowsHoldingValueMeta,
  rowsHoldingValueOf,
  rowsHoldingValueSummary,
} from '../src/core/migrations/rows-holding-value';

const mark = {
  enumValue: { namespaceId: asNamespaceId('app'), enum: 'Status', member: 'ARCHIVED' },
  value: 'archived',
  codecRef: { codecId: 'pg/text@1' },
};

describe('rows that hold a removed stored value', () => {
  it('reads back the mark a removal check carries, its enum value a coordinate, and nothing from another check', () => {
    expect(
      rowsHoldingValueOf({
        description: 'check',
        sql: 'SELECT 1',
        meta: rowsHoldingValueMeta(mark),
      }),
    ).toEqual(mark);
    expect(
      rowsHoldingValueOf({
        description: 'check',
        sql: 'SELECT 1',
        meta: rowsHoldingValueMeta({ enumValue: { enum: 'Status', member: 'A' }, value: 1 }),
      }),
    ).toEqual({ enumValue: { enum: 'Status', member: 'A' }, value: 1 });
    expect(rowsHoldingValueOf({ description: 'check', sql: 'SELECT 1' })).toBeUndefined();
  });

  it('says how many rows hold the value as the database stores it', () => {
    expect(rowsHoldingValueSummary('task', 'status', 'archived', 1)).toBe(
      '1 row of "task" holds "archived" in column "status", which takes no NULL, so the value cannot be removed.',
    );
    expect(rowsHoldingValueSummary('task', 'rank', 3, 2)).toBe(
      '2 rows of "task" hold 3 in column "rank", which takes no NULL, so the value cannot be removed.',
    );
  });
});
