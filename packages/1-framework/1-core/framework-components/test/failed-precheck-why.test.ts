import { describe, expect, it } from 'vitest';
import { failedPrecheckWhy } from '../src/control/runner-failure-why';

describe('failedPrecheckWhy', () => {
  it('names the operation and shows the check description as written', () => {
    expect(
      failedPrecheckWhy({
        operationId: 'op',
        phase: 'precheck',
        description: 'ensure index "Item_state_idx" does not exist',
      }),
    ).toBe(
      'Before operation op runs, it checks: ensure index "Item_state_idx" does not exist. That check failed on this database.',
    );
  });
});
