import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SqlQueryError } from '@internal/sql-errors';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBoundDriverFromBinding,
  type SqliteBinding,
  SqliteConnectionImpl,
} from '../src/sqlite-driver';

let testDir: string;
let testPath: string;

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'prisma-sqlite-test-'));
  testPath = join(testDir, 'test.db');
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

function createDriver() {
  const binding: SqliteBinding = { kind: 'path', path: testPath };
  return createBoundDriverFromBinding(binding);
}

describe('SqliteBoundDriver', () => {
  it('connects to a file database', async () => {
    const driver = createDriver();
    expect(driver.state).toBe('connected');
    await driver.close();
  });

  it('executes CREATE TABLE and INSERT via query()', async () => {
    const driver = createDriver();
    await driver.query('CREATE TABLE t(id INTEGER PRIMARY KEY, name TEXT)');
    await driver.query('INSERT INTO t VALUES (?, ?)', [1, 'alice']);
    const result = await driver.query<{ id: number; name: string }>('SELECT * FROM t');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ id: 1, name: 'alice' });
    await driver.close();
  });

  it('executes SELECT via execute() returning AsyncIterable', async () => {
    const driver = createDriver();
    await driver.query('CREATE TABLE t(id INTEGER PRIMARY KEY, val TEXT)');
    await driver.query('INSERT INTO t VALUES (1, ?)', ['a']);
    await driver.query('INSERT INTO t VALUES (2, ?)', ['b']);
    await driver.query('INSERT INTO t VALUES (3, ?)', ['c']);

    const rows: Array<{ id: number; val: string }> = [];
    for await (const row of driver.execute<{ id: number; val: string }>({
      sql: 'SELECT * FROM t ORDER BY id',
    })) {
      rows.push(row);
    }

    expect(rows).toEqual([
      { id: 1, val: 'a' },
      { id: 2, val: 'b' },
      { id: 3, val: 'c' },
    ]);
    await driver.close();
  });

  it('supports EXPLAIN QUERY PLAN', async () => {
    const driver = createDriver();
    await driver.query('CREATE TABLE t(id INTEGER PRIMARY KEY, val TEXT)');

    const explain = await driver.explain!({ sql: 'SELECT * FROM t WHERE id = 1' });
    expect(explain.rows.length).toBeGreaterThan(0);
    await driver.close();
  });

  it('enables foreign keys by default', async () => {
    const driver = createDriver();
    await driver.query('CREATE TABLE parent(id INTEGER PRIMARY KEY)');
    await driver.query(
      'CREATE TABLE child(id INTEGER PRIMARY KEY, pid INTEGER REFERENCES parent(id))',
    );
    await driver.query('INSERT INTO parent VALUES (?)', [1]);

    await expect(driver.query('INSERT INTO child VALUES (?, ?)', [1, 999])).rejects.toThrow(
      SqlQueryError,
    );
    await driver.close();
  });

  it('close() is idempotent', async () => {
    const driver = createDriver();
    await driver.close();
    expect(driver.state).toBe('closed');
    await driver.close();
    expect(driver.state).toBe('closed');
  });

  it('normalizes unique constraint errors to SqlQueryError', async () => {
    const driver = createDriver();
    await driver.query('CREATE TABLE t(id INTEGER PRIMARY KEY, val TEXT UNIQUE)');
    await driver.query('INSERT INTO t VALUES (?, ?)', [1, 'a']);

    try {
      await driver.query('INSERT INTO t VALUES (?, ?)', [2, 'a']);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(SqlQueryError.is(error)).toBe(true);
      expect((error as SqlQueryError).sqlState).toBe('23505');
    }
    await driver.close();
  });

  it('normalizes foreign key constraint errors to SqlQueryError', async () => {
    const driver = createDriver();
    await driver.query('CREATE TABLE parent(id INTEGER PRIMARY KEY)');
    await driver.query(
      'CREATE TABLE child(id INTEGER PRIMARY KEY, pid INTEGER REFERENCES parent(id))',
    );

    try {
      await driver.query('INSERT INTO child VALUES (?, ?)', [1, 999]);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(SqlQueryError.is(error)).toBe(true);
      expect((error as SqlQueryError).sqlState).toBe('23503');
    }
    await driver.close();
  });
});

describe('SqliteConnection', () => {
  it('acquireConnection returns a connection that shares database state', async () => {
    const driver = createDriver();
    await driver.query('CREATE TABLE t(id INTEGER PRIMARY KEY)');
    const conn = await driver.acquireConnection();
    const result = await conn.query<{ id: number }>('SELECT * FROM t');
    expect(result.rows).toHaveLength(0);
    await conn.release();
    await driver.close();
  });

  it('independent connections have isolated transactions', async () => {
    const driver = createDriver();
    await driver.query('CREATE TABLE t(id INTEGER PRIMARY KEY, val TEXT)');

    const conn1 = await driver.acquireConnection();
    const conn2 = await driver.acquireConnection();

    const tx1 = await conn1.beginTransaction();
    await tx1.query('INSERT INTO t VALUES (?, ?)', [1, 'from-tx1']);
    await tx1.commit();

    // conn2 sees committed data
    const after = await conn2.query<{ id: number }>('SELECT * FROM t');
    expect(after.rows).toHaveLength(1);

    await conn1.release();
    await conn2.release();
    await driver.close();
  });
});

describe('SqliteTransaction', () => {
  it('commits a transaction', async () => {
    const driver = createDriver();
    await driver.query('CREATE TABLE t(id INTEGER PRIMARY KEY, val TEXT)');

    const conn = await driver.acquireConnection();
    const tx = await conn.beginTransaction();
    await tx.query('INSERT INTO t VALUES (?, ?)', [1, 'a']);
    await tx.query('INSERT INTO t VALUES (?, ?)', [2, 'b']);
    await tx.commit();
    await conn.release();

    const result = await driver.query<{ id: number }>('SELECT * FROM t');
    expect(result.rows).toHaveLength(2);
    await driver.close();
  });

  it('rolls back a transaction', async () => {
    const driver = createDriver();
    await driver.query('CREATE TABLE t(id INTEGER PRIMARY KEY, val TEXT)');
    await driver.query('INSERT INTO t VALUES (?, ?)', [1, 'before']);

    const conn = await driver.acquireConnection();
    const tx = await conn.beginTransaction();
    await tx.query('INSERT INTO t VALUES (?, ?)', [2, 'rolled-back']);
    await tx.rollback();
    await conn.release();

    const result = await driver.query<{ id: number }>('SELECT * FROM t');
    expect(result.rows).toHaveLength(1);
    await driver.close();
  });

  it('supports execute() within a transaction', async () => {
    const driver = createDriver();
    await driver.query('CREATE TABLE t(id INTEGER PRIMARY KEY, val TEXT)');

    const conn = await driver.acquireConnection();
    const tx = await conn.beginTransaction();
    await tx.query('INSERT INTO t VALUES (?, ?)', [1, 'a']);

    const rows: Array<{ id: number; val: string }> = [];
    for await (const row of tx.execute<{ id: number; val: string }>({
      sql: 'SELECT * FROM t',
    })) {
      rows.push(row);
    }
    expect(rows).toHaveLength(1);

    await tx.commit();
    await conn.release();
    await driver.close();
  });
});

describe('SqliteConnectionImpl cleanup retries', () => {
  it('release() leaves the connection retryable when close() throws', async () => {
    const db = new DatabaseSync(':memory:');
    const closeSpy = vi.spyOn(db, 'close').mockImplementationOnce(() => {
      throw new Error('busy: statement in progress');
    });

    const connection = new SqliteConnectionImpl(db);

    // First release surfaces the close error (release must not swallow).
    await expect(connection.release()).rejects.toThrow('busy');
    expect(closeSpy).toHaveBeenCalledTimes(1);

    // The handle is still open; a retry must actually attempt close again
    // instead of short-circuiting on an internal "disposed" flag.
    closeSpy.mockRestore();
    await expect(connection.release()).resolves.toBeUndefined();
    expect(db.isOpen).toBe(false);
  });

  it('destroy() propagates close() errors and leaves the connection retryable', async () => {
    const db = new DatabaseSync(':memory:');
    const closeSpy = vi.spyOn(db, 'close').mockImplementationOnce(() => {
      throw new Error('busy: statement in progress');
    });

    const connection = new SqliteConnectionImpl(db);

    // destroy() propagates teardown errors; the call site decides whether to
    // swallow. The connection is left retryable so a follow-up cleanup can
    // actually close the handle once the underlying condition clears.
    await expect(connection.destroy(new Error('rollback failed'))).rejects.toThrow('busy');
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(db.isOpen).toBe(true);

    closeSpy.mockRestore();
    await expect(connection.destroy()).resolves.toBeUndefined();
    expect(db.isOpen).toBe(false);
  });

  it('release() after a failed destroy() finally closes the handle', async () => {
    const db = new DatabaseSync(':memory:');
    const closeSpy = vi.spyOn(db, 'close').mockImplementationOnce(() => {
      throw new Error('busy: statement in progress');
    });

    const connection = new SqliteConnectionImpl(db);

    await expect(connection.destroy(new Error('rollback failed'))).rejects.toThrow('busy');
    expect(db.isOpen).toBe(true);

    closeSpy.mockRestore();
    await expect(connection.release()).resolves.toBeUndefined();
    expect(db.isOpen).toBe(false);
  });
});
