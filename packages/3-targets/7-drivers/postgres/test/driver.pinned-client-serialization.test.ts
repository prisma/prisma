import type { PreparedExecuteRequest } from '@internal/sql-relational-core/ast';
import { timeouts } from '@repo/test-utils';
import type { Client, Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { createBoundDriverFromBinding } from '../src/postgres-driver';

interface ConcurrencyState {
  inFlight: number;
  maxInFlight: number;
  readonly started: string[];
  readonly completed: string[];
}

function createConcurrencyState(): ConcurrencyState {
  return { inFlight: 0, maxInFlight: 0, started: [], completed: [] };
}

function textOf(arg: unknown): string {
  if (typeof arg === 'string') {
    return arg;
  }
  if (typeof arg === 'object' && arg !== null && 'text' in arg) {
    return String((arg as { text: unknown }).text);
  }
  return '<unknown>';
}

function makeTrackedClient(state: ConcurrencyState) {
  return {
    connect: async () => undefined,
    end: async () => undefined,
    query: async (arg: unknown, _values?: unknown[]) => {
      const text = textOf(arg);
      state.inFlight++;
      state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
      state.started.push(text);
      await new Promise((resolve) => setTimeout(resolve, 1));
      state.inFlight--;
      state.completed.push(text);
      return { rows: [{ echo: text }], rowCount: 1 };
    },
  };
}

function makeDirectDriver(state: ConcurrencyState) {
  const client = makeTrackedClient(state);
  return createBoundDriverFromBinding(
    { kind: 'pgClient', client: client as unknown as Client },
    { disabled: true },
  );
}

async function consume<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const row of iterable) {
    out.push(row);
  }
  return out;
}

function makeHandleSlot(): PreparedExecuteRequest['handle'] {
  let value: unknown;
  return {
    get: () => value,
    set: (v: unknown) => {
      value = v;
    },
  };
}

describe('pinned-client serialization', { timeout: timeouts.databaseOperation }, () => {
  it('runs concurrent query() calls on a direct driver one at a time in FIFO order', async () => {
    const state = createConcurrencyState();
    const driver = makeDirectDriver(state);

    await Promise.all([
      driver.query('select 1'),
      driver.query('select 2'),
      driver.query('select 3'),
    ]);

    expect(state.maxInFlight).toBe(1);
    expect(state.started).toEqual(['select 1', 'select 2', 'select 3']);
    expect(state.completed).toEqual(['select 1', 'select 2', 'select 3']);
  });

  it('serializes mixed execute/executePrepared/explain/query overlap on a direct driver', async () => {
    const state = createConcurrencyState();
    const driver = makeDirectDriver(state);
    const explain = driver.explain;
    if (explain === undefined) {
      throw new Error('driver.explain is not implemented');
    }

    await Promise.all([
      consume(driver.execute({ sql: 'select a' })),
      consume(driver.executePrepared({ sql: 'select b', params: [], handle: makeHandleSlot() })),
      explain.call(driver, { sql: 'select c' }),
      driver.query('select d'),
    ]);

    expect(state.maxInFlight).toBe(1);
    expect(state.started).toHaveLength(4);
  });

  it('serializes overlapping queries on a pinned connection', async () => {
    const state = createConcurrencyState();
    const driver = makeDirectDriver(state);
    const connection = await driver.acquireConnection();

    await Promise.all([connection.query('select 1'), connection.query('select 2')]);
    await connection.release();

    expect(state.maxInFlight).toBe(1);
    expect(state.started).toEqual(['select 1', 'select 2']);
  });

  it('serializes overlapping queries on a transaction handle, boundaries included', async () => {
    const state = createConcurrencyState();
    const driver = makeDirectDriver(state);
    const connection = await driver.acquireConnection();
    const transaction = await connection.beginTransaction();

    await Promise.all([
      transaction.query('select 1'),
      transaction.query('select 2'),
      consume(transaction.execute({ sql: 'select 3' })),
    ]);
    await transaction.commit();
    await connection.release();

    expect(state.maxInFlight).toBe(1);
    expect(state.started).toEqual(['BEGIN', 'select 1', 'select 2', 'select 3', 'COMMIT']);
    expect(state.completed).toEqual(['BEGIN', 'select 1', 'select 2', 'select 3', 'COMMIT']);
  });

  it('serializes driver-level and pinned-connection statements sharing one physical client', async () => {
    const state = createConcurrencyState();
    const driver = makeDirectDriver(state);
    const connection = await driver.acquireConnection();

    await Promise.all([connection.query('select lease'), driver.query('select driver')]);
    await connection.release();

    expect(state.maxInFlight).toBe(1);
  });

  it('completes a nested query awaited inside buffered stream iteration on a pinned connection', async () => {
    const state = createConcurrencyState();
    const driver = makeDirectDriver(state);
    const connection = await driver.acquireConnection();

    const nested: unknown[] = [];
    for await (const row of connection.execute<{ echo: string }>({ sql: 'select outer' })) {
      expect(row).toEqual({ echo: 'select outer' });
      const inner = await connection.query<{ echo: string }>('select inner');
      nested.push(inner.rows[0]);
    }
    await connection.release();

    expect(nested).toEqual([{ echo: 'select inner' }]);
    expect(state.completed).toEqual(['select outer', 'select inner']);
  });

  it('completes a nested query awaited inside buffered stream iteration on a transaction', async () => {
    const state = createConcurrencyState();
    const driver = makeDirectDriver(state);
    const connection = await driver.acquireConnection();
    const transaction = await connection.beginTransaction();

    const nested: unknown[] = [];
    for await (const row of transaction.execute<{ echo: string }>({ sql: 'select outer' })) {
      expect(row).toEqual({ echo: 'select outer' });
      const inner = await transaction.query<{ echo: string }>('select inner');
      nested.push(inner.rows[0]);
    }
    await transaction.commit();
    await connection.release();

    expect(nested).toEqual([{ echo: 'select inner' }]);
    expect(state.completed).toEqual(['BEGIN', 'select outer', 'select inner', 'COMMIT']);
  });

  it('runs a follow-up query after a partially iterated buffered stream is abandoned', async () => {
    const state = createConcurrencyState();
    const driver = makeDirectDriver(state);

    const iterator = driver
      .execute<{ echo: string }>({ sql: 'select abandoned' })
      [Symbol.asyncIterator]();
    const first = await iterator.next();
    expect(first.done).toBe(false);

    const after = await driver.query<{ echo: string }>('select after');
    expect(after.rows).toEqual([{ echo: 'select after' }]);
  });

  it('commits a transaction while a buffered stream on it is still open', async () => {
    const state = createConcurrencyState();
    const driver = makeDirectDriver(state);
    const connection = await driver.acquireConnection();
    const transaction = await connection.beginTransaction();

    const iterator = transaction
      .execute<{ echo: string }>({ sql: 'select open-stream' })
      [Symbol.asyncIterator]();
    const first = await iterator.next();
    expect(first.done).toBe(false);

    await transaction.commit();
    await connection.release();
    expect(state.completed).toEqual(['BEGIN', 'select open-stream', 'COMMIT']);
  });

  it('does not serialize pool-level queries across distinct pool clients', async () => {
    const state = createConcurrencyState();
    const pool = {
      connect: async () => ({
        ...makeTrackedClient(state),
        release: () => undefined,
      }),
      end: async () => undefined,
    };
    const driver = createBoundDriverFromBinding(
      { kind: 'pgPool', pool: pool as unknown as Pool },
      { disabled: true },
    );

    await Promise.all([driver.query('select 1'), driver.query('select 2')]);

    expect(state.maxInFlight).toBe(2);
  });
});
