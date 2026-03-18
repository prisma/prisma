import { IsolationLevel, SqlMigrationAwareDriverAdapterFactory } from '@prisma/driver-adapter-utils'
import { describe, expect, test } from 'vitest'

import { PrismaBetterSqlite3AdapterFactory } from './better-sqlite3'

describe.each([
  (factory: SqlMigrationAwareDriverAdapterFactory) => factory.connect(),
  (factory: SqlMigrationAwareDriverAdapterFactory) => factory.connectToShadowDb(),
])('behavior of the adapter with "%s"', (connect) => {
  test('executes and parses simple queries', async () => {
    const factory = new PrismaBetterSqlite3AdapterFactory({ url: ':memory:' })
    const conn = await connect(factory)

    await expect(
      conn.queryRaw({
        sql: 'SELECT ? as col1, ? as col2',
        args: [1, 'str'],
        argTypes: [
          { arity: 'scalar', scalarType: 'int' },
          { arity: 'scalar', scalarType: 'string' },
        ],
      }),
    ).resolves.toMatchObject({
      columnNames: ['col1', 'col2'],
      rows: [[1, 'str']],
    })
  })

  test('executes and parses simple statements', async () => {
    const factory = new PrismaBetterSqlite3AdapterFactory({ url: ':memory:' })
    const conn = await connect(factory)

    await expect(
      conn.executeRaw({
        sql: 'CREATE TABLE test (id TEXT PRIMARY KEY, name TEXT)',
        args: [],
        argTypes: [],
      }),
    ).resolves.toBe(0)

    await expect(
      conn.executeRaw({
        sql: 'INSERT INTO test (id, name) VALUES (?, ?)',
        args: ['1', 'John'],
        argTypes: [
          { arity: 'scalar', scalarType: 'string' },
          { arity: 'scalar', scalarType: 'string' },
        ],
      }),
    ).resolves.toBe(1)

    await expect(
      conn.queryRaw({
        sql: 'SELECT * FROM test',
        args: [],
        argTypes: [],
      }),
    ).resolves.toMatchObject({ rows: [['1', 'John']] })
  })

  test('supports positional ?N parameter bindings', async () => {
    const factory = new PrismaBetterSqlite3AdapterFactory({ url: ':memory:' })
    const conn = await connect(factory)

    await conn.executeScript(`
      CREATE TABLE test (id TEXT PRIMARY KEY, email TEXT);
      INSERT INTO test VALUES ('alice', 'alice@example.com');
      INSERT INTO test VALUES ('bob', 'bob@example.com');
      INSERT INTO test VALUES ('adam', 'adam@example.net');
    `)

    await expect(
      conn.queryRaw({
        sql: "SELECT id FROM test WHERE id LIKE ?1 OR email LIKE ?1 ORDER BY id",
        args: ['a%'],
        argTypes: [{ arity: 'scalar', scalarType: 'string' }],
      }),
    ).resolves.toMatchObject({
      rows: [['adam'], ['alice']],
    })
  })

  test('supports named :param parameter bindings with a single reused name', async () => {
    const factory = new PrismaBetterSqlite3AdapterFactory({ url: ':memory:' })
    const conn = await connect(factory)

    await conn.executeScript(`
      CREATE TABLE test (id TEXT PRIMARY KEY, email TEXT);
      INSERT INTO test VALUES ('alice', 'alice@example.com');
      INSERT INTO test VALUES ('bob', 'bob@example.com');
      INSERT INTO test VALUES ('adam', 'adam@example.net');
    `)

    await expect(
      conn.queryRaw({
        sql: "SELECT id FROM test WHERE id = :name OR email LIKE :name ORDER BY id",
        args: ['alice'],
        argTypes: [{ arity: 'scalar', scalarType: 'string' }],
      }),
    ).resolves.toMatchObject({
      rows: [['alice']],
    })
  })

  test('supports named :param bindings with multiple distinct parameters', async () => {
    const factory = new PrismaBetterSqlite3AdapterFactory({ url: ':memory:' })
    const conn = await connect(factory)

    await conn.executeScript(`
      CREATE TABLE test (id TEXT PRIMARY KEY, email TEXT);
      INSERT INTO test VALUES ('alice', 'alice@example.com');
      INSERT INTO test VALUES ('bob', 'bob@example.net');
      INSERT INTO test VALUES ('adam', 'adam@example.com');
    `)

    await expect(
      conn.queryRaw({
        sql: "SELECT id FROM test WHERE id = :username OR email LIKE '%@' || :domain ORDER BY id",
        args: ['bob', 'example.com'],
        argTypes: [
          { arity: 'scalar', scalarType: 'string' },
          { arity: 'scalar', scalarType: 'string' },
        ],
      }),
    ).resolves.toMatchObject({
      rows: [['adam'], ['alice'], ['bob']],
    })
  })

  test('query errors get converted to DriverAdapterError', async () => {
    const factory = new PrismaBetterSqlite3AdapterFactory({ url: ':memory:' })
    const conn = await connect(factory)

    await expect(
      conn.queryRaw({
        sql: 'SELECT * FROM non_existent_table',
        args: [],
        argTypes: [],
      }),
    ).rejects.toMatchObject({
      name: 'DriverAdapterError',
    })
  })

  test('rejects unsupported isolation levels', async () => {
    const factory = new PrismaBetterSqlite3AdapterFactory({ url: ':memory:' })
    const conn = await connect(factory)

    for (const level of [
      'READ UNCOMMITTED',
      'READ COMMITTED',
      'REPEATABLE READ',
      'SNAPSHOT',
    ] satisfies IsolationLevel[]) {
      await expect(conn.startTransaction(level)).rejects.toMatchObject({
        name: 'DriverAdapterError',
        cause: { kind: 'InvalidIsolationLevel' },
      })
    }
  })

  test('ignores placeholders inside string literals', async () => {
    const factory = new PrismaBetterSqlite3AdapterFactory({ url: ':memory:' })
    const conn = await connect(factory)

    await expect(
      conn.queryRaw({
        sql: "SELECT '?' as a, ':name' as b, ? as real",
        args: [42],
        argTypes: [{ arity: 'scalar', scalarType: 'int' }],
      }),
    ).resolves.toMatchObject({
      rows: [['?', ':name', 42]],
    })
  })

  test('ignores placeholders inside quoted identifiers', async () => {
    const factory = new PrismaBetterSqlite3AdapterFactory({ url: ':memory:' })
    const conn = await connect(factory)

    await expect(
      conn.queryRaw({
        sql: 'SELECT 1 as "col:name", 2 as `a?b`, 3 as [x:y], ? as real',
        args: [99],
        argTypes: [{ arity: 'scalar', scalarType: 'int' }],
      }),
    ).resolves.toMatchObject({
      rows: [[1, 2, 3, 99]],
    })
  })

  test('ignores placeholders inside comments', async () => {
    const factory = new PrismaBetterSqlite3AdapterFactory({ url: ':memory:' })
    const conn = await connect(factory)

    await expect(
      conn.queryRaw({
        sql: `
        -- ? should be ignored
        /* :name should be ignored */
        SELECT ? as real
      `,
        args: [7],
        argTypes: [{ arity: 'scalar', scalarType: 'int' }],
      }),
    ).resolves.toMatchObject({
      rows: [[7]],
    })
  })

  test('distinguishes between positional $1 and named $param', async () => {
    const factory = new PrismaBetterSqlite3AdapterFactory({ url: ':memory:' })
    const conn = await connect(factory)

    await conn.executeScript(`
    CREATE TABLE test (id TEXT PRIMARY KEY);
    INSERT INTO test VALUES ('a'), ('b');
  `)

    await expect(
      conn.queryRaw({
        sql: 'SELECT id FROM test WHERE id = $1',
        args: ['a'],
        argTypes: [{ arity: 'scalar', scalarType: 'string' }],
      }),
    ).resolves.toMatchObject({
      rows: [['a']],
    })
  })

  test('rejects mixing positional and named parameters', async () => {
    const factory = new PrismaBetterSqlite3AdapterFactory({ url: ':memory:' })
    const conn = await connect(factory)

    await expect(
      conn.queryRaw({
        sql: 'SELECT ?1, :name',
        args: [1, 'test'],
        argTypes: [
          { arity: 'scalar', scalarType: 'int' },
          { arity: 'scalar', scalarType: 'string' },
        ],
      }),
    ).rejects.toThrow()
  })

  test('handles mixed ordering of positional parameters', async () => {
  const factory = new PrismaBetterSqlite3AdapterFactory({ url: ':memory:' })
  const conn = await connect(factory)

  await expect(
    conn.queryRaw({
      sql: 'SELECT ?2 as b, ?1 as a',
      args: ['first', 'second'],
      argTypes: [
        { arity: 'scalar', scalarType: 'string' },
        { arity: 'scalar', scalarType: 'string' },
      ],
    }),
  ).resolves.toMatchObject({
    rows: [['second', 'first']],
  })
})
})