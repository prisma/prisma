import { describe, expect, it } from 'vitest';
import { checkExpectationOf, expectAbsent, expectPresent } from '../src/control/check-expectation';

describe('checkExpectationOf', () => {
  it('keeps an expectation of the right shape and drops any other value', () => {
    expect(
      [
        expectAbsent('index "x" on "users"'),
        expectPresent('table "users"'),
        { expects: 'gone', object: 'index "x"' },
        { expects: 'absent' },
        { expects: 'absent', object: '' },
        'index "x"',
        undefined,
      ].map(checkExpectationOf),
    ).toEqual([
      { expects: 'absent', object: 'index "x" on "users"' },
      { expects: 'present', object: 'table "users"' },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });
});
