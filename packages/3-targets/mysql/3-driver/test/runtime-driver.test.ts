import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import mysqlRuntimeDriver from '../src/core/runtime/runtime-driver';
import { SESSION_SETUP } from '../src/core/session-setup';

class FakeConnection extends EventEmitter {
  readonly release = vi.fn();
  readonly destroy = vi.fn();
  prepareError: unknown;

  readonly constantSql: unknown[] = [];

  query(sql: unknown, callback: (error: unknown, result: unknown) => void) {
    this.constantSql.push(sql);
    queueMicrotask(() => callback(null, { affectedRows: 0 }));
    return new EventEmitter();
  }

  prepare(_sql: unknown, callback: (error: unknown, statement: unknown) => void) {
    queueMicrotask(() => callback(this.prepareError ?? null, { parameters: [] }));
  }

  execute(_options: unknown, callback?: (error: unknown, result: unknown) => void) {
    if (callback) {
      queueMicrotask(() => callback(null, { affectedRows: 0 }));
      return new EventEmitter();
    }
    const command = new EventEmitter();
    return Object.assign(command, {
      stream: () =>
        new Readable({
          objectMode: true,
          read() {
            this.destroy(
              Object.assign(new Error('Server shutdown in progress'), {
                fatal: true,
                sqlState: '08S01',
              }),
            );
          },
        }),
    });
  }
}

const connection = new FakeConnection();

vi.mock('mysql2', async (importOriginal) => ({
  ...(await importOriginal<typeof import('mysql2')>()),
  createPool: () => ({
    getConnection: (callback: (error: unknown, conn: FakeConnection) => void) =>
      callback(null, connection),
    end: (callback: () => void) => callback(),
  }),
}));

describe('MySQL runtime driver with a fatal stream error', () => {
  it('destroys the connection instead of returning it to the pool', async () => {
    const driver = mysqlRuntimeDriver.create();
    await driver.connect({ kind: 'url', url: 'mysql://root@localhost/db' });
    const rows = driver.query({ containsRawSql: false, sql: 'SELECT 1' })[Symbol.asyncIterator]();
    await expect(rows.next()).rejects.toMatchObject({ sqlState: '08S01' });
    expect({
      destroyed: connection.destroy.mock.calls.length,
      released: connection.release.mock.calls.length,
    }).toEqual({ destroyed: 1, released: 0 });
  });
});

describe('MySQL runtime driver at the server limit on prepared statements', () => {
  it('names statementCacheSize and connectionLimit when MySQL refuses to prepare another statement', async () => {
    connection.prepareError = Object.assign(
      new Error("Can't create more than max_prepared_stmt_count statements"),
      {
        errno: 1461,
        sqlState: '42000',
      },
    );
    try {
      const driver = mysqlRuntimeDriver.create();
      await driver.connect({ kind: 'url', url: 'mysql://root@localhost/db' });
      await expect(
        driver.execute({ containsRawSql: false, sql: 'SELECT 1' }),
      ).rejects.toMatchObject({
        code: 'DRIVER.PREPARE_FAILED',
        fix: expect.stringContaining('statementCacheSize'),
      });
    } finally {
      connection.prepareError = undefined;
    }
  });
});

describe('MySQL runtime driver session restore', () => {
  it('re-runs the session setup only after a statement that holds caller-written SQL', async () => {
    const driver = mysqlRuntimeDriver.create();
    await driver.connect({ kind: 'url', url: 'mysql://root@localhost/db' });
    const setups = () => connection.constantSql.length / SESSION_SETUP.length;
    await driver.execute({ sql: 'SELECT 0', containsRawSql: false });
    const start = setups();
    await driver.execute({ sql: 'SELECT 1', containsRawSql: false });
    await driver.execute({ containsRawSql: false, sql: 'SELECT 2' });
    const withoutCallerSql = setups() - start;
    await driver.execute({ sql: "SET time_zone = '+05:00'", containsRawSql: true });
    await driver.execute({ sql: 'SELECT 3', containsRawSql: false });
    const afterCallerSql = setups() - start;
    expect({ withoutCallerSql, afterCallerSql }).toEqual({
      withoutCallerSql: 0,
      afterCallerSql: 1,
    });
  });
});
