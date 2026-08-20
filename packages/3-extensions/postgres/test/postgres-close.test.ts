import type { SqlStorage } from '@internal/sql-contract/types';
import { createContract } from '@repo/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Only mock the third-party pg boundary. Real drivers, adapters, and runtimes
// run over this fake pool/client.
vi.mock('pg', () => {
  const poolEndSpy = vi.fn().mockResolvedValue(undefined);
  const querySpy = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  const releaseSpy = vi.fn();

  const connectSpy = vi.fn().mockResolvedValue({
    query: querySpy,
    release: releaseSpy,
  });

  class Pool {
    on = vi.fn().mockReturnThis();
    static readonly _endSpy = poolEndSpy;
    static readonly _connectSpy = connectSpy;
    readonly _options: unknown;

    constructor(options: unknown) {
      this._options = options;
    }

    connect = connectSpy;
    end = poolEndSpy;
    totalCount = 0;
    idleCount = 0;
    waitingCount = 0;
  }

  class Client {
    on = vi.fn().mockReturnThis();
    connect = vi.fn().mockResolvedValue(undefined);
    query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    end = vi.fn().mockResolvedValue(undefined);
    release = vi.fn();
    escapeIdentifier = vi.fn();
    escapeLiteral = vi.fn();
  }

  return { Pool, Client };
});

import { Client, Pool } from 'pg';
import postgres from '../src/runtime/postgres';

const contract = createContract<SqlStorage>();

function poolEndSpy() {
  return (Pool as unknown as { _endSpy: ReturnType<typeof vi.fn> })._endSpy;
}

beforeEach(() => {
  vi.clearAllMocks();
  poolEndSpy().mockResolvedValue(undefined);
  (Pool as unknown as { _connectSpy: ReturnType<typeof vi.fn> })._connectSpy.mockResolvedValue({
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  });
});

describe('postgres close()', () => {
  it('releases the facade-owned Pool when constructed from { url }', async () => {
    const db = postgres({ contract, url: 'postgres://localhost:5432/db' });
    db.runtime();
    await Promise.resolve();

    await db.close();

    expect(poolEndSpy()).toHaveBeenCalledTimes(1);
  });

  it('does NOT close a caller-supplied pg.Pool', async () => {
    const pool = new Pool({ connectionString: 'postgres://localhost:5432/db' });
    const ownEndSpy = vi.fn().mockResolvedValue(undefined);
    (pool as unknown as { end: typeof vi.fn }).end = ownEndSpy;

    const db = postgres({ contract, pg: pool });
    db.runtime();
    await db.close();

    expect(ownEndSpy).not.toHaveBeenCalled();
  });

  it('does NOT close a caller-supplied pg.Client', async () => {
    const client = new Client();
    const db = postgres({ contract, pg: client });
    db.runtime();
    await db.close();

    expect(client.end).not.toHaveBeenCalled();
  });

  it('is idempotent: calling twice does not throw and does not double-dispose the owned pool', async () => {
    const db = postgres({ contract, url: 'postgres://localhost:5432/db' });
    db.runtime();
    await Promise.resolve();

    await db.close();
    await db.close();

    expect(poolEndSpy()).toHaveBeenCalledTimes(1);
  });

  it('close() is idempotent even after a failed pool.end()', async () => {
    // A first close() that fails due to pool.end() error must not leave the
    // facade in a state where a second close() tries pool.end() again.
    poolEndSpy().mockRejectedValueOnce(new Error('pool.end failed')).mockResolvedValue(undefined);

    const db = postgres({ contract, url: 'postgres://localhost:5432/db' });
    db.runtime();
    // Wait for background connect setup (ownedDispose) to be wired
    await Promise.resolve();
    await Promise.resolve();

    // First close fails because pool.end() throws
    await expect(db.close()).rejects.toThrow('pool.end failed');

    // Second close is a no-op (already disposed guard)
    await expect(db.close()).resolves.toBeUndefined();
    // pool.end was not called a second time
    expect(poolEndSpy()).toHaveBeenCalledTimes(1);
  });

  it('before any connect is a no-op', async () => {
    const db = postgres({ contract, url: 'postgres://localhost:5432/db' });
    await db.close();
    expect(poolEndSpy()).not.toHaveBeenCalled();
  });

  it('db.runtime() rejects with "Postgres client is closed" after close()', async () => {
    const db = postgres({ contract, url: 'postgres://localhost:5432/db' });
    await db.close();
    expect(() => db.runtime()).toThrow('Postgres client is closed');
  });

  it('db.connect() rejects with "Postgres client is closed" after close()', async () => {
    const db = postgres({ contract, url: 'postgres://localhost:5432/db' });
    await db.close();
    await expect(db.connect()).rejects.toThrow('Postgres client is closed');
  });

  it('await using db executes [Symbol.asyncDispose] on scope exit (pool.end called)', async () => {
    async function run() {
      await using db = postgres({ contract, url: 'postgres://localhost:5432/db' });
      db.runtime();
      await Promise.resolve();
    }

    await run();
    expect(poolEndSpy()).toHaveBeenCalledTimes(1);
  });
});
