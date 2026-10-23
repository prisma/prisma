import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import mysqlRuntimeDriver from '../src/core/runtime/runtime-driver';

class FakeConnection extends EventEmitter {
  readonly release = vi.fn();
  readonly destroy = vi.fn();

  query(_options: unknown, callback?: (error: unknown, result: unknown) => void) {
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
    const rows = driver.query({ sql: 'SELECT 1' })[Symbol.asyncIterator]();
    await expect(rows.next()).rejects.toMatchObject({ sqlState: '08S01' });
    expect({
      destroyed: connection.destroy.mock.calls.length,
      released: connection.release.mock.calls.length,
    }).toEqual({ destroyed: 1, released: 0 });
  });
});
