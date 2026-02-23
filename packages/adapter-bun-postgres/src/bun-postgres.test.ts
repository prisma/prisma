import { ColumnTypeEnum, DriverAdapterError } from '@prisma/driver-adapter-utils'

import { PrismaBunPostgresAdapter, PrismaBunPostgresAdapterFactory } from './bun-postgres'

describe('PrismaBunPostgresAdapter', () => {
  test('maps query results and execute counts', async () => {
    const recordedCalls: Array<{ sql: string; values?: unknown[] }> = []

    const client = {
      unsafe: async (sql: string, values?: unknown[]) => {
        recordedCalls.push({ sql, values })

        return Object.assign(
          [
            {
              id: 1n,
              amount: '1.25',
              active: true,
              payload: { ok: true },
              createdAt: new Date('2024-01-01T00:00:00.000Z'),
              bytes: Buffer.from([1, 2]),
            },
          ],
          {
            count: 1,
            command: 'SELECT',
            affectedRows: 0,
          },
        )
      },
      reserve: async () => {
        throw new Error('reserve should not be called in this test')
      },
      close: async () => {},
      release: async () => {},
    }

    const adapter = new PrismaBunPostgresAdapter(client as any)

    const result = await adapter.queryRaw({
      sql: 'SELECT * FROM test WHERE id = $1',
      args: [1n],
      argTypes: [{ scalarType: 'bigint', arity: 'scalar' }],
    })

    expect(recordedCalls).toHaveLength(1)
    expect(recordedCalls[0].values).toEqual([1n])

    expect(result.columnNames).toEqual(['id', 'amount', 'active', 'payload', 'createdAt', 'bytes'])
    expect(result.columnTypes).toEqual([
      ColumnTypeEnum.Int64,
      ColumnTypeEnum.Numeric,
      ColumnTypeEnum.Boolean,
      ColumnTypeEnum.Json,
      ColumnTypeEnum.DateTime,
      ColumnTypeEnum.Bytes,
    ])

    expect(result.rows[0][0]).toEqual('1')
    expect(result.rows[0][1]).toEqual('1.25')
    expect(result.rows[0][2]).toEqual(true)
    expect(result.rows[0][3]).toEqual(JSON.stringify({ ok: true }))
    expect(result.rows[0][4]).toEqual('2024-01-01T00:00:00.000+00:00')
    expect(result.rows[0][5]).toEqual(new Uint8Array([1, 2]))

    const affectedRows = await adapter.executeRaw({
      sql: 'UPDATE test SET active = true',
      args: [],
      argTypes: [],
    })

    expect(affectedRows).toBe(0)
  })

  test('supports transactions, rollback and savepoints', async () => {
    const txSql: string[] = []
    let releaseCallCount = 0

    const txClient = {
      unsafe: async (sql: string) => {
        txSql.push(sql)
        return Object.assign([], { count: 0, command: 'OK', affectedRows: 0 })
      },
      close: async () => {},
      release: async () => {
        releaseCallCount += 1
      },
    }

    const client = {
      unsafe: async () => Object.assign([], { count: 0, command: 'OK', affectedRows: 0 }),
      reserve: async () => txClient,
      close: async () => {},
      release: async () => {},
    }

    const adapter = new PrismaBunPostgresAdapter(client as any)
    const tx = await adapter.startTransaction('SERIALIZABLE')

    await tx.createSavepoint?.('sp_1')
    await tx.rollbackToSavepoint?.('sp_1')
    await tx.releaseSavepoint?.('sp_1')
    await tx.rollback()

    expect(txSql).toEqual([
      'BEGIN',
      'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE',
      'SAVEPOINT sp_1',
      'ROLLBACK TO SAVEPOINT sp_1',
      'RELEASE SAVEPOINT sp_1',
    ])
    expect(releaseCallCount).toBe(1)
  })

  test('maps driver errors', async () => {
    const client = {
      unsafe: async () => {
        throw {
          code: 'ERR_POSTGRES_SERVER_ERROR',
          errno: '23505',
          severity: 'ERROR',
          detail: 'Key (id)=(1) already exists.',
          message: 'duplicate key value violates unique constraint',
        }
      },
      reserve: async () => {
        throw new Error('reserve should not be called in this test')
      },
      close: async () => {},
      release: async () => {},
    }

    const adapter = new PrismaBunPostgresAdapter(client as any)

    await expect(
      adapter.queryRaw({
        sql: 'SELECT 1',
        args: [],
        argTypes: [],
      }),
    ).rejects.toMatchObject({
      name: 'DriverAdapterError',
      cause: {
        kind: 'UniqueConstraintViolation',
      },
    } satisfies Partial<DriverAdapterError>)
  })
})

describe('PrismaBunPostgresAdapterFactory', () => {
  test('creates and disposes a shadow database adapter', async () => {
    const adminStatements: string[] = []
    const createdConnectionStrings: string[] = []

    let adminCloseCalls = 0
    let shadowCloseCalls = 0

    const adminClient = {
      unsafe: async (sql: string) => {
        adminStatements.push(sql)
        return Object.assign([], { count: 0, command: 'OK', affectedRows: 0 })
      },
      reserve: async () => {
        throw new Error('reserve should not be called in this test')
      },
      close: async () => {
        adminCloseCalls += 1
      },
      release: async () => {},
    }

    const shadowClient = {
      unsafe: async () => Object.assign([], { count: 0, command: 'OK', affectedRows: 0 }),
      reserve: async () => {
        throw new Error('reserve should not be called in this test')
      },
      close: async () => {
        shadowCloseCalls += 1
      },
      release: async () => {},
    }

    const factory = new PrismaBunPostgresAdapterFactory(
      {
        connectionString: 'postgres://localhost:5432/main',
      },
      async (connectionString) => {
        createdConnectionStrings.push(connectionString.toString())
        return createdConnectionStrings.length === 1 ? (adminClient as any) : (shadowClient as any)
      },
    )

    const adapter = await factory.connectToShadowDb()
    await adapter.dispose()

    expect(createdConnectionStrings).toHaveLength(2)
    expect(adminStatements[0]?.startsWith('CREATE DATABASE "prisma_migrate_shadow_db_')).toBe(true)
    expect(adminStatements[1]?.startsWith('DROP DATABASE "prisma_migrate_shadow_db_')).toBe(true)
    expect(adminCloseCalls).toBe(1)
    expect(shadowCloseCalls).toBe(1)
  })
})
