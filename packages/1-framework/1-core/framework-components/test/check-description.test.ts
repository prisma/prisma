import { describe, expect, it } from 'vitest';
import { failedPrecheckWhy, readCheckDescription } from '../src/control/runner-failure-why';

describe('readCheckDescription', () => {
  it('reads the forms that expect an object absent or present, keeping where it is', () => {
    expect(
      [
        'ensure index "x" does not exist',
        'ensure column "y" does not exist on "item"',
        'index does not already exist on users',
        'ensure column "x" is missing',
        'ensure value "b" is absent from enum type "Mood"',
        'ensure table "x" exists',
        'index exists on users',
      ].map(readCheckDescription),
    ).toEqual([
      { expects: 'absent', object: 'index "x"' },
      { expects: 'absent', object: 'column "y" on "item"' },
      { expects: 'absent', object: 'index on users' },
      { expects: 'absent', object: 'column "x"' },
      { expects: 'absent', object: 'value "b" in enum type "Mood"' },
      { expects: 'present', object: 'table "x"' },
      { expects: 'present', object: 'index on users' },
    ]);
  });

  it('reads any other description as neither', () => {
    expect(
      [
        'ensure no NULL values in "note"',
        'ensure no table or index is named "thing" in any case',
      ].map(readCheckDescription),
    ).toEqual([undefined, undefined]);
  });
});

describe('failedPrecheckWhy', () => {
  it('names the check and says what its failure means of the database', () => {
    expect(
      [
        'ensure index "Item_state_idx" does not exist',
        'ensure table "x" exists',
        'some other check',
      ].map((description) =>
        failedPrecheckWhy({ operationId: 'op', phase: 'precheck', description }),
      ),
    ).toEqual([
      'Before operation op runs, it checks: ensure index "Item_state_idx" does not exist. That check failed: the database already has index "Item_state_idx".',
      'Before operation op runs, it checks: ensure table "x" exists. That check failed: the database has no table "x".',
      'Before operation op runs, it checks: some other check. That check failed on this database.',
    ]);
  });
});
