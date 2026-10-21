import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import {
  CheckExpectationSchema,
  expectAbsent,
  expectPresent,
} from '../src/control/check-expectation';

describe('CheckExpectationSchema', () => {
  it('accepts an expectation the constructors build and refuses any other shape', () => {
    expect(
      [
        expectAbsent('index "x" on "users"'),
        expectPresent('table "users"'),
        { expects: 'gone', object: 'index "x"' },
        { expects: 'absent' },
        { expects: 'absent', object: '' },
        'index "x"',
      ].map((value) => !(CheckExpectationSchema(value) instanceof type.errors)),
    ).toEqual([true, true, false, false, false, false]);
  });
});
