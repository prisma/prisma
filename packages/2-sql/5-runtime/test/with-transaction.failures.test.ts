import { describe, expect, it } from 'vitest';
import type { SqlMiddleware } from '../src/middleware/sql-middleware';
import { withTransaction } from '../src/sql-runtime';
import { createSetup, names, rawPlan } from './transaction-activity-fixtures';

describe('withTransaction when a transaction hook fails', () => {
  it('rethrows an activityEnded error after a resolved COMMIT without a ROLLBACK, and finalizes committed', async () => {
    const hookError = new Error('transaction ended hook failed');
    const failingEnd: SqlMiddleware = {
      name: 'failing-end',
      familyId: 'sql',
      async activityEnded(activity) {
        if (activity.kind === 'transaction') throw hookError;
      },
    };
    const { runtime, events } = createSetup({ middleware: [failingEnd] });

    const run = withTransaction(runtime, async (tx) => {
      await tx.execute(rawPlan('update t set x = 1'));
    });

    await expect(run).rejects.toBe(hookError);
    expect(names(events)).not.toContain('rollback');
    expect(names(events)).toContain('finalized:transaction:committed');
    expect(names(events).at(-1)).toBe('release');
  });
});

describe('withTransaction when the transaction cannot start', () => {
  it('destroys the connection when BEGIN fails', async () => {
    const { runtime, events } = createSetup({ failures: { begin: new Error('begin failed') } });

    await expect(withTransaction(runtime, async () => undefined)).rejects.toThrow('begin failed');

    expect(names(events).filter((name) => name === 'release' || name === 'destroy')).toEqual([
      'destroy',
    ]);
  });

  it('destroys the connection when the transaction activityStarted throws', async () => {
    const refused = new Error('started failed');
    const failingStart: SqlMiddleware = {
      name: 'failing-start',
      familyId: 'sql',
      async activityStarted(activity) {
        if (activity.kind === 'transaction') throw refused;
      },
    };
    const { runtime, events } = createSetup({ middleware: [failingStart] });

    await expect(withTransaction(runtime, async () => undefined)).rejects.toBe(refused);

    expect(names(events)).not.toContain('begin');
    expect(names(events).filter((name) => name === 'release' || name === 'destroy')).toEqual([
      'destroy',
    ]);
  });
});
