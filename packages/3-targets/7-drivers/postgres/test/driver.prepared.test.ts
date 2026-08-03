import { SqlQueryError } from '@internal/sql-errors';
import type { PreparedExecuteRequest } from '@internal/sql-relational-core/ast';
import { timeouts } from '@repo/test-utils';
import type { Client } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBoundDriverFromBinding, type PostgresBinding } from '../src/postgres-driver';

interface MockQueryArg {
  readonly arg: unknown;
  readonly values: readonly unknown[] | undefined;
}

interface MockConfig {
  readonly handler?: (call: MockQueryArg, callIndex: number) => unknown | Error;
}

function makeMockClient(config: MockConfig = {}) {
  const handler = config.handler ?? (() => ({ rows: [] }));
  const calls: MockQueryArg[] = [];
  const client = {
    _connection: {},
    _ending: false,
    connect: vi.fn(async () => undefined),
    end: vi.fn(async () => undefined),
    query: vi.fn(async (arg: unknown, values?: unknown[]) => {
      const call: MockQueryArg = { arg, values };
      calls.push(call);
      const outcome = handler(call, calls.length - 1);
      if (outcome instanceof Error) {
        throw outcome;
      }
      return outcome ?? { rows: [] };
    }),
  };
  return { client, calls };
}

function makeSlot(initial?: unknown) {
  let value: unknown = initial;
  return {
    slot: {
      get: () => value,
      set: (v: unknown) => {
        value = v;
      },
    } satisfies PreparedExecuteRequest['handle'],
    snapshot: () => value,
  };
}

async function consume<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const row of iterable) {
    out.push(row);
  }
  return out;
}

function makePgError(code: string, message = `simulated ${code}`): Error {
  return Object.assign(new Error(message), { code });
}

function makeDriver(binding: PostgresBinding, preparedStatements?: boolean) {
  // Disable cursor so the buffered path is exercised directly — the mock
  // client doesn't implement pg-cursor's protocol.
  return createBoundDriverFromBinding(
    binding,
    { disabled: true },
    preparedStatements === undefined ? undefined : { preparedStatements },
  );
}

describe('postgres prepared statements', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      await cleanups.pop()?.();
    }
  }, timeouts.spinUpPpgDev);

  describe('preparedStatements: false', () => {
    it('issues anonymous queries and leaves the handle slot unset', async () => {
      const { client, calls } = makeMockClient({
        handler: () => ({ rows: [{ id: 1 }] }),
      });
      const driver = makeDriver({ kind: 'pgClient', client: client as unknown as Client }, false);
      cleanups.push(() => driver.close());

      const { slot, snapshot } = makeSlot();
      const sql = 'select id from t where x = $1';
      await consume(driver.executePrepared({ sql, params: [42], handle: slot }));
      await consume(driver.executePrepared({ sql, params: [99], handle: slot }));

      expect(snapshot()).toBeUndefined();
      expect(calls).toHaveLength(2);
      expect(calls[0]?.arg).toMatchObject({ name: undefined, text: sql, values: [42] });
      expect(calls[1]?.arg).toMatchObject({ name: undefined, text: sql, values: [99] });
    });

    it('does not trigger the 26000 retry path', async () => {
      let invocations = 0;
      const { client } = makeMockClient({
        handler: () => {
          invocations += 1;
          return makePgError('26000', 'unexpected on anonymous query');
        },
      });
      const driver = makeDriver({ kind: 'pgClient', client: client as unknown as Client }, false);
      cleanups.push(() => driver.close());

      const { slot } = makeSlot();
      await expect(
        consume(driver.executePrepared({ sql: 'select 1', params: [], handle: slot })),
      ).rejects.toBeInstanceOf(SqlQueryError);
      expect(invocations).toBe(1);
    });
  });
});
