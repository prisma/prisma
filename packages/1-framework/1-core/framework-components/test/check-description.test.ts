import { describe, expect, it } from 'vitest';
import { readCheckDescription } from '../src/control/check-description';

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
