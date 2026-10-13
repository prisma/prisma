import { describe, expect, it } from 'vitest';
import { settlementOf } from '../src/transaction-state';
import { testCall } from './client-activity-kinds';
import { createSetup, type HookEvent, names, rawPlan } from './transaction-activity-fixtures';

function eventOf(events: readonly HookEvent[], name: string): HookEvent | undefined {
  return events.find((candidate) => candidate.name === name);
}

const driverCalls = (events: readonly HookEvent[]) =>
  names(events).filter((name) =>
    ['begin', 'commit', 'rollback', 'release', 'destroy'].includes(name),
  );

describe('the transaction of an activity handle', () => {
  describe('opened on the runtime', () => {
    it('starts beneath the activity on a connection it releases after commit', async () => {
      const { runtime, events } = createSetup();
      const call = await runtime.startActivity(testCall);

      const transaction = await call.transaction?.();
      await transaction?.execute(rawPlan('update t set x = 1'));
      await transaction?.commit();
      await call.end({ outcome: 'succeeded' });

      expect(eventOf(events, 'started:transaction')?.ctx?.parent).toBe(
        eventOf(events, 'started:test-call')?.ctx,
      );
      expect(driverCalls(events)).toEqual(['begin', 'commit', 'release']);
      expect(names(events).filter((name) => name.startsWith('finalized:'))).toEqual([
        'finalized:statement:committed',
        'finalized:transaction:committed',
        'finalized:test-call:committed',
      ]);
    });

    it('releases the connection after a rollback', async () => {
      const { runtime, events } = createSetup();
      const call = await runtime.startActivity(testCall);

      const transaction = await call.transaction?.();
      await transaction?.rollback();
      await call.end({ outcome: 'failed' });

      expect(driverCalls(events)).toEqual(['begin', 'rollback', 'release']);
    });

    it('destroys the connection after a failed rollback', async () => {
      const { runtime, events } = createSetup({
        failures: { rollback: new Error('rollback failed') },
      });
      const call = await runtime.startActivity(testCall);

      const transaction = await call.transaction?.();
      await expect(transaction?.rollback()).rejects.toThrow('rollback failed');
      await call.end({ outcome: 'failed' });

      expect(driverCalls(events)).toEqual(['begin', 'rollback', 'destroy']);
    });

    it('keeps the connection after a failed commit until the rollback that follows', async () => {
      const { runtime, events } = createSetup({ failures: { commit: new Error('commit failed') } });
      const call = await runtime.startActivity(testCall);

      const transaction = await call.transaction?.();
      await expect(transaction?.commit()).rejects.toThrow('commit failed');
      const afterCommit = driverCalls(events);
      await transaction?.rollback();
      await call.end({ outcome: 'failed' });

      expect(afterCommit).toEqual(['begin', 'commit']);
      expect(driverCalls(events)).toEqual(['begin', 'commit', 'rollback', 'release']);
    });

    it('destroys the connection when BEGIN fails', async () => {
      const { runtime, events } = createSetup({ failures: { begin: new Error('begin failed') } });
      const call = await runtime.startActivity(testCall);

      await expect(call.transaction?.()).rejects.toThrow('begin failed');
      await call.end({ outcome: 'failed' });

      expect(driverCalls(events)).toEqual(['begin', 'destroy']);
    });

    it('carries the settlement of the transaction it wraps', async () => {
      const { runtime } = createSetup();
      const call = await runtime.startActivity(testCall);

      const transaction = await call.transaction?.();
      await transaction?.commit();
      await call.end({ outcome: 'succeeded' });

      expect(transaction && settlementOf(transaction)?.committed).toBe(true);
    });
  });

  it('opened on a connection, begins on that connection and leaves it held', async () => {
    const { runtime, events } = createSetup();
    const connection = await runtime.connection();
    const call = await connection.startActivity(testCall);

    const transaction = await call.transaction?.();
    await transaction?.commit();
    await call.end({ outcome: 'succeeded' });
    const beforeRelease = driverCalls(events);
    await connection.release();

    expect(beforeRelease).toEqual(['begin', 'commit']);
  });

  it('is absent on a handle opened under a transaction, and on the handles nested in it', async () => {
    const { runtime } = createSetup();
    const connection = await runtime.connection();
    const transaction = await connection.transaction();

    const call = await transaction.startActivity(testCall);
    const nested = await call.startActivity(testCall);

    expect(['transaction' in call, 'transaction' in nested]).toEqual([false, false]);
    await nested.end({ outcome: 'succeeded' });
    await call.end({ outcome: 'succeeded' });
    await transaction.commit();
    await connection.release();
  });
});
