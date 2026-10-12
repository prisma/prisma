import { describe, expect, it } from 'vitest';
import type { SqlMiddleware } from '../src/middleware/sql-middleware';
import { withTransaction } from '../src/sql-runtime';
import { createSetup, names, rawPlan } from './transaction-activity-fixtures';

function failingTransactionEnd(error: unknown): SqlMiddleware {
  return {
    name: 'failing-end',
    familyId: 'sql',
    async activityEnded(activity) {
      if (activity.kind === 'transaction') throw error;
    },
  };
}

describe('withTransaction when a transaction hook fails', () => {
  it('rethrows an activityEnded error after a resolved COMMIT without a ROLLBACK, and finalizes committed', async () => {
    const hookError = new Error('transaction ended hook failed');
    const { runtime, events } = createSetup({ middleware: [failingTransactionEnd(hookError)] });

    const run = withTransaction(runtime, async (tx) => {
      await tx.execute(rawPlan('update t set x = 1'));
    });

    await expect(run).rejects.toBe(hookError);
    expect(names(events)).not.toContain('rollback');
    expect(names(events)).toContain('finalized:transaction:committed');
    expect(names(events).at(-1)).toBe('release');
  });

  it('rethrows a non-object thrown by activityEnded after a resolved COMMIT, without a ROLLBACK', async () => {
    const { runtime, events } = createSetup({ middleware: [failingTransactionEnd('hook failed')] });

    const run = withTransaction(runtime, async (tx) => {
      await tx.execute(rawPlan('update t set x = 1'));
    });

    await expect(run).rejects.toBe('hook failed');
    expect(names(events)).not.toContain('rollback');
    expect(names(events)).toContain('finalized:transaction:committed');
  });
});

describe('a transaction whose COMMIT resolved', () => {
  it('ignores rollback() after a commit() that rejected with a hook error', async () => {
    const hookError = new Error('transaction ended hook failed');
    const { runtime, events } = createSetup({ middleware: [failingTransactionEnd(hookError)] });
    const transaction = await (await runtime.connection()).transaction();
    await transaction.execute(rawPlan('update t set x = 1'));

    await expect(transaction.commit()).rejects.toBe(hookError);
    await expect(transaction.rollback()).resolves.toBeUndefined();

    expect(names(events)).not.toContain('rollback');
    expect(names(events).filter((name) => name.includes(':transaction:'))).toEqual([
      'ended:transaction:succeeded',
      'finalized:transaction:committed',
    ]);
  });

  it('ignores rollback() after a commit() that resolved', async () => {
    const { runtime, events } = createSetup();
    const transaction = await (await runtime.connection()).transaction();

    await transaction.commit();
    await transaction.rollback();

    expect(names(events)).not.toContain('rollback');
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

  it('releases the connection when the transaction activityStarted throws a non-object', async () => {
    const failingStart: SqlMiddleware = {
      name: 'failing-start',
      familyId: 'sql',
      async activityStarted(activity) {
        if (activity.kind === 'transaction') throw 'started failed';
      },
    };
    const { runtime, events } = createSetup({ middleware: [failingStart] });

    await expect(withTransaction(runtime, async () => undefined)).rejects.toBe('started failed');

    expect(names(events)).not.toContain('begin');
    expect(names(events).filter((name) => name === 'release' || name === 'destroy')).toEqual([
      'release',
    ]);
  });

  it('releases the connection when the transaction activityStarted throws, because no BEGIN was sent', async () => {
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
      'release',
    ]);
  });
});
