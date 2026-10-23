import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import mysqlRuntimeDriver from '../src/core/runtime/runtime-driver';
import { SESSION_SETUP } from '../src/core/session-setup';

class FakeConnection extends EventEmitter {
  readonly release = vi.fn();
  readonly destroy = vi.fn();
  prepareError: unknown;
  streamFails = true;

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
    const fails = this.streamFails;
    return Object.assign(command, {
      stream: () =>
        new Readable({
          objectMode: true,
          read() {
            if (!fails) {
              this.push(null);
              queueMicrotask(() => command.emit('end'));
              return;
            }
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

describe('MySQL runtime driver and raw SQL', () => {
  beforeEach(() => {
    connection.streamFails = false;
  });
  afterEach(() => {
    connection.streamFails = true;
  });

  async function connected() {
    const driver = mysqlRuntimeDriver.create();
    await driver.connect({ kind: 'url', url: 'mysql://root@localhost/db' });
    await driver.execute({ containsRawSql: false, sql: 'SELECT 0' });
    const setups = () => connection.constantSql.filter((sql) => sql === SESSION_SETUP[0]).length;
    const start = {
      setups: setups(),
      released: connection.release.mock.calls.length,
      destroyed: connection.destroy.mock.calls.length,
    };
    const since = () => ({
      setups: setups() - start.setups,
      released: connection.release.mock.calls.length - start.released,
      destroyed: connection.destroy.mock.calls.length - start.destroyed,
    });
    return { driver, since };
  }

  it('returns a pooled connection to the pool after a statement without raw SQL', async () => {
    const { driver, since } = await connected();
    await driver.execute({ containsRawSql: false, sql: 'SELECT 1' });
    for await (const _row of driver.query({ containsRawSql: false, sql: 'SELECT 2' })) {
    }
    expect(since()).toEqual({ setups: 0, released: 2, destroyed: 0 });
  });

  it('destroys a pooled connection that ran raw SQL instead of returning it to the pool', async () => {
    const { driver, since } = await connected();
    await driver.execute({ containsRawSql: true, sql: "SET time_zone = '+05:00'" });
    for await (const _row of driver.query({ containsRawSql: true, sql: 'SET autocommit = 0' })) {
    }
    expect(since()).toEqual({ setups: 0, released: 0, destroyed: 2 });
  });

  it('restores the session before a holder runs its next statement after raw SQL, and destroys the connection on release', async () => {
    const { driver, since } = await connected();
    const held = await driver.acquireConnection();
    await held.execute({ containsRawSql: true, sql: "SET time_zone = '+05:00'" });
    const beforeNext = since();
    await held.execute({ containsRawSql: false, sql: 'SELECT 1' });
    await held.execute({ containsRawSql: false, sql: 'SELECT 2' });
    const afterNext = since();
    await held.release();
    expect({ beforeNext, afterNext, released: since() }).toEqual({
      beforeNext: { setups: 0, released: 0, destroyed: 0 },
      afterNext: { setups: 1, released: 0, destroyed: 0 },
      released: { setups: 1, released: 0, destroyed: 1 },
    });
  });

  it('returns a held connection to the pool when nothing on it ran raw SQL', async () => {
    const { driver, since } = await connected();
    const held = await driver.acquireConnection();
    await held.execute({ containsRawSql: false, sql: 'SELECT 1' });
    const transaction = await held.beginTransaction();
    await transaction.execute({ containsRawSql: false, sql: 'SELECT 2' });
    await transaction.commit();
    await held.release();
    expect(since()).toEqual({ setups: 0, released: 1, destroyed: 0 });
  });

  it('destroys a held connection on release when its transaction ran raw SQL', async () => {
    const { driver, since } = await connected();
    const held = await driver.acquireConnection();
    const transaction = await held.beginTransaction();
    await transaction.execute({ containsRawSql: true, sql: 'SET foreign_key_checks = 0' });
    await transaction.execute({ containsRawSql: false, sql: 'SELECT 1' });
    await transaction.commit();
    await held.release();
    expect(since()).toEqual({ setups: 1, released: 0, destroyed: 1 });
  });

  it('keeps raw SQL on one driver from marking a connection on another', async () => {
    const first = await connected();
    const second = await connected();
    const held = await first.driver.acquireConnection();
    await held.execute({ containsRawSql: true, sql: "SET time_zone = '+05:00'" });
    const otherHeld = await second.driver.acquireConnection();
    await otherHeld.execute({ containsRawSql: false, sql: 'SELECT 1' });
    await otherHeld.release();
    expect(second.since()).toEqual({ setups: 0, released: 1, destroyed: 0 });
  });
});
