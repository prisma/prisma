import { DatabaseSync } from 'node:sqlite';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import type { SqlControlDriverInstance } from '@internal/sql-contract/types';
import { createSqliteBuiltinCodecLookup } from '@internal/target-sqlite/codecs';
import { describe, expect, it } from 'vitest';
import { SqliteControlAdapter } from '../src/core/control-adapter';

function createMemoryDriver(initSql: string): SqlControlDriverInstance<'sqlite'> & {
  readonly db: DatabaseSync;
} {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(initSql);
  return {
    familyId: 'sql' as const,
    targetId: 'sqlite' as const,
    async query<Row = Record<string, unknown>>(sql: string, params?: readonly unknown[]) {
      const stmt = db.prepare(sql);
      const rows = stmt.all(...((params ?? []) as Array<string | number | null>)) as Row[];
      return { rows };
    },
    async close() {
      db.close();
    },
    db,
  };
}

function contractDeclaringTables(tables: readonly string[]): unknown {
  return {
    storage: {
      namespaces: {
        [UNBOUND_NAMESPACE_ID]: {
          entries: { table: Object.fromEntries(tables.map((name) => [name, {}])) },
        },
      },
    },
  };
}

const adapter = new SqliteControlAdapter(createSqliteBuiltinCodecLookup());

const INIT_SQL = `
  CREATE TABLE "user" (id INTEGER PRIMARY KEY, email TEXT NOT NULL);
  CREATE TABLE "_prisma_migrations" (
    id TEXT PRIMARY KEY NOT NULL,
    checksum TEXT NOT NULL
  );
  CREATE TABLE "_prisma_marker" (space TEXT PRIMARY KEY);
  CREATE TABLE "_prisma_ledger" (id INTEGER PRIMARY KEY);
`;

describe('SqliteControlAdapter introspection of migration tool tables', () => {
  it('leaves out _prisma_migrations when no contract is given', async () => {
    const driver = createMemoryDriver(INIT_SQL);
    const result = await adapter.introspect(driver);

    expect(Object.keys(result.tables)).toEqual(['user']);
    await driver.close();
  });

  it('leaves out _prisma_migrations when the contract does not declare it', async () => {
    const driver = createMemoryDriver(INIT_SQL);
    const result = await adapter.introspect(driver, contractDeclaringTables(['user']));

    expect(Object.keys(result.tables)).toEqual(['user']);
    await driver.close();
  });

  it('keeps _prisma_migrations when the contract declares it', async () => {
    const driver = createMemoryDriver(INIT_SQL);
    const result = await adapter.introspect(
      driver,
      contractDeclaringTables(['_prisma_migrations', 'user']),
    );

    expect(Object.keys(result.tables)).toEqual(['_prisma_migrations', 'user']);
    await driver.close();
  });
});
