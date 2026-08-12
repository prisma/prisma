import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import sqliteControlDriverDescriptor, { SqliteControlDriver } from '../src/exports/control';

let testDir: string;
let testPath: string;

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'prisma-sqlite-test-'));
  testPath = join(testDir, 'test.db');
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('SqliteControlDriverDescriptor', () => {
  it('has correct descriptor metadata', () => {
    expect(sqliteControlDriverDescriptor.kind).toBe('driver');
    expect(sqliteControlDriverDescriptor.familyId).toBe('sql');
    expect(sqliteControlDriverDescriptor.targetId).toBe('sqlite');
  });

  it('creates a control driver from file path', async () => {
    const driver = await sqliteControlDriverDescriptor.create(testPath);
    expect(driver).toBeInstanceOf(SqliteControlDriver);
    expect(driver.familyId).toBe('sql');
    expect(driver.targetId).toBe('sqlite');
    await driver.close();
  });

  it('executes queries via control driver', async () => {
    const driver = await sqliteControlDriverDescriptor.create(testPath);
    await driver.query('CREATE TABLE t(id INTEGER PRIMARY KEY, val TEXT)');
    await driver.query('INSERT INTO t VALUES (?, ?)', [1, 'hello']);
    const result = await driver.query<{ id: number; val: string }>('SELECT * FROM t');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ id: 1, val: 'hello' });
    await driver.close();
  });

  it('has foreign keys enabled', async () => {
    const driver = await sqliteControlDriverDescriptor.create(testPath);
    const result = await driver.query<{ foreign_keys: number }>('PRAGMA foreign_keys');
    expect(result.rows[0]?.foreign_keys).toBe(1);
    await driver.close();
  });
});
