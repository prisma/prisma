import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Config, createClient } from '@libsql/client'
import { PrismaLibSQL } from '../dist/index.js'
import { ColumnTypeEnum } from '@jkomyno/prisma-driver-adapter-utils'

function connect(config?: Partial<Config>): PrismaLibSQL {
  const client = createClient({ url: 'file:test.db', ...config })
  return new PrismaLibSQL(client)
}

it('checks declared types', async () => {
  const client = connect()

  await client.executeRaw({
    sql: `
      DROP TABLE IF EXISTS types;
    `,
    args: [],
  })

  await client.executeRaw({
    sql: `
      CREATE TABLE types (
        id     INTEGER PRIMARY KEY,
        real   REAL,
        bigint BIGINT,
        date   DATETIME,
        text   TEXT,
        blob   BLOB
      )
    `,
    args: [],
  })

  const result = await client.queryRaw({
    sql: `
      SELECT * FROM types
    `,
    args: [],
  })

  assert(result.ok)
  assert.deepEqual(result.value.columnTypes, [
    ColumnTypeEnum.Int32,
    ColumnTypeEnum.Double,
    ColumnTypeEnum.Int64,
    ColumnTypeEnum.DateTime,
    ColumnTypeEnum.Text,
    ColumnTypeEnum.Bytes,
  ])
})

it('infers types when sqlite decltype is not available', async () => {
  const client = connect()

  const result = await client.queryRaw({
    sql: `
      SELECT 1 as first, 'test' as second
    `,
    args: [],
  })

  assert(result.ok)
  assert.deepEqual(result.value.columnTypes, [ColumnTypeEnum.Int64, ColumnTypeEnum.Text])
})

describe('int64 with different intMode', () => {
  const N = 2n ** 63n - 1n

  it('correctly infers int64 with intMode=number for safe JS integers', async () => {
    const client = connect({ intMode: 'number' })

    const result = await client.queryRaw({
      sql: `SELECT ?`,
      args: [Number.MAX_SAFE_INTEGER],
    })

    assert(result.ok)
    assert.equal(result.value.columnTypes[0], ColumnTypeEnum.Int64)
    assert.equal(result.value.rows[0][0], Number.MAX_SAFE_INTEGER)
  })

  it("doesn't support very big int64 with intMode=number", async () => {
    const client = connect({ intMode: 'number' })

    assert.rejects(
      client.queryRaw({
        sql: `SELECT ?`,
        args: [N],
      }),
    )
  })

  it('correctly infers int64 with intMode=bigint', async () => {
    const client = connect({ intMode: 'bigint' })

    const result = await client.queryRaw({
      sql: `SELECT ?`,
      args: [N],
    })

    assert(result.ok)
    assert.equal(result.value.columnTypes[0], ColumnTypeEnum.Int64)

    // bigints are converted to strings because we can't currently pass a bigint
    // to rust due to a napi.rs limitation
    assert.equal(result.value.rows[0][0], N.toString())
  })

  it('correctly infers int64 with intMode=string when we have decltype', async () => {
    const client = connect({ intMode: 'string' })

    await client.executeRaw({
      sql: `DROP TABLE IF EXISTS test`,
      args: [],
    })

    await client.executeRaw({
      sql: `CREATE TABLE test (int64 BIGINT)`,
      args: [],
    })

    await client.executeRaw({
      sql: `INSERT INTO test (int64) VALUES (?)`,
      args: [N],
    })

    const result = await client.queryRaw({
      sql: `SELECT int64 FROM test`,
      args: [],
    })

    assert(result.ok)
    assert.equal(result.value.columnTypes[0], ColumnTypeEnum.Int64)
    assert.equal(result.value.rows[0][0], N.toString())
  })

  it("can't infer int64 with intMode=string without schema", async () => {
    const client = connect({ intMode: 'string' })

    const result = await client.queryRaw({
      sql: `SELECT ?`,
      args: [N],
    })

    assert(result.ok)
    assert.equal(result.value.columnTypes[0], ColumnTypeEnum.Text)
    assert.equal(result.value.rows[0][0], N.toString())
  })
})
