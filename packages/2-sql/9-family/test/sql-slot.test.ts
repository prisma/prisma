import { describe, expect, it } from 'vitest';
import { isUnfilledSlot, slotSource, sqlOfSlot } from '../src/core/migrations/sql-slot';

const written = { kind: 'sql', sql: '"age"::int4' } as const;
const unfilled = { kind: 'placeholder', slot: 'User.age:using' } as const;

describe('SqlSlot', () => {
  it('renders written SQL as a string and an unfilled slot as a placeholder call', () => {
    expect([slotSource(written), slotSource(unfilled)]).toEqual([
      '"\\"age\\"::int4"',
      'placeholder("User.age:using")',
    ]);
  });

  it('tells an unfilled slot from written SQL, and gives the SQL of a written one', () => {
    expect([
      isUnfilledSlot(written),
      isUnfilledSlot(unfilled),
      isUnfilledSlot(undefined),
      sqlOfSlot(written),
      sqlOfSlot(unfilled),
      sqlOfSlot(undefined),
    ]).toEqual([false, true, false, '"age"::int4', undefined, undefined]);
  });
});
