import { describe, expect, it } from 'vitest';
import {
  rowsHoldingValueMeta,
  rowsHoldingValueOf,
  rowsHoldingValueSummary,
} from '../src/core/migrations/rows-holding-value';

const mark = { enumValue: 'Status.ARCHIVED', value: 'archived' };

describe('rows that hold a removed stored value', () => {
  it('reads back the mark a removal check carries, and nothing from another check', () => {
    expect(
      rowsHoldingValueOf({
        description: 'check',
        sql: 'SELECT 1',
        meta: rowsHoldingValueMeta(mark),
      }),
    ).toEqual(mark);
    expect(rowsHoldingValueOf({ description: 'check', sql: 'SELECT 1' })).toBeUndefined();
  });

  it('says how many rows hold the value, and that the enum value cannot be removed', () => {
    expect(rowsHoldingValueSummary(mark, 'task', 'status', 1)).toBe(
      '1 row of "task" holds "archived" in column "status", which takes no NULL, so enum value "Status.ARCHIVED" cannot be removed.',
    );
    expect(rowsHoldingValueSummary({ ...mark, value: 3 }, 'task', 'rank', 2)).toBe(
      '2 rows of "task" hold 3 in column "rank", which takes no NULL, so enum value "Status.ARCHIVED" cannot be removed.',
    );
  });
});
