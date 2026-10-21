import { describe, expect, it } from 'vitest';
import { failedPrecheckWhy } from '../src/control/runner-failure-why';

const check = {
  operationId: 'op',
  phase: 'precheck',
  description: 'ensure index "Item_state_idx" does not exist',
} as const;

describe('failedPrecheckWhy', () => {
  it('names the operation and shows the check description as written', () => {
    expect(failedPrecheckWhy(check)).toBe(
      'Before operation op runs, it checks: ensure index "Item_state_idx" does not exist. That check failed on this database.',
    );
  });

  it('says what the database already has when the check expected the object absent', () => {
    expect(
      failedPrecheckWhy({
        ...check,
        expectation: { expects: 'absent', object: 'index "Item_state_idx"' },
      }),
    ).toBe(
      'Before operation op runs, it checks: ensure index "Item_state_idx" does not exist. That check failed: the database already has index "Item_state_idx".',
    );
  });

  it('says the database has no such object when the check expected the object present', () => {
    expect(
      failedPrecheckWhy({
        operationId: 'op',
        phase: 'precheck',
        description: 'ensure table "x" exists',
        expectation: { expects: 'present', object: 'table "x"' },
      }),
    ).toBe(
      'Before operation op runs, it checks: ensure table "x" exists. That check failed: the database has no table "x".',
    );
  });
});
