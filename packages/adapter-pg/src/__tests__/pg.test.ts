import { getLogs } from '@prisma/debug'
import type { SqlQuery } from '@prisma/driver-adapter-utils'
import pg, { DatabaseError } from 'pg'
import { describe, expect, it, vi } from 'vitest'

import { getStatementName, PrismaPgAdapterFactory } from '../pg'

describe('getStatementName', () => {
  it('returns a deterministic name for the same SQL', () => {
    const query: SqlQuery = { sql: 'SELECT $1', args: [], argTypes: [] }
    const name1 = getStatementName(query)
    const name2 = getStatementName(query)
    expect(name1).toBe(name2)
  })

  it('returns names prefixed with p_', () => {
    const query: SqlQuery = { sql: 'SELECT 1', args: [], argTypes: [] }
    expect(getStatementName(query)).toMatch(/^p_[0-9a-f]{16}$/)
  })

  it('returns different names for different SQL', () => {
    const q1: SqlQuery = { sql: 'SELECT 1', args: [], argTypes: [] }
    const q2: SqlQuery = { sql: 'SELECT 2', args: [], argTypes: [] }
    expect(getStatementName(q1)).not.toBe(getStatementName(q2))
  })

  it('includes argTypes in the hash', () => {
    const q1: SqlQuery = {
      sql: 'SELECT $1',
      args: [1],
      argTypes: [{ scalarType: 'int', arity: 'scalar' }],
    }
    const q2: SqlQuery = {
      sql: 'SELECT $1',
      args: ['hello'],
      argTypes: [{ scalarType: 'string', arity: 'scalar' }],
    }
    expect(getStatementName(q1)).not.toBe(getStatementName(q2))
  })

  it('distinguishes scalar vs list arity', () => {
    const q1: SqlQuery = {
      sql: 'SELECT $1',
      args: [1],
      argTypes: [{ scalarType: 'int', arity: 'scalar' }],
    }
    const q2: SqlQuery = {
      sql: 'SELECT $1',
      args: [[1, 2]],
      argTypes: [{ scalarType: 'int', arity: 'list' }],
    }
    expect(getStatementName(q1)).not.toBe(getStatementName(q2))
  })

  it('is stable for queries with multiple argTypes', () => {
    const query: SqlQuery = {
      sql: 'SELECT $1, $2, $3',
      args: [1, 'hello', true],
      argTypes: [
        { scalarType: 'int', arity: 'scalar' },
        { scalarType: 'string', arity: 'scalar' },
        { scalarType: 'boolean', arity: 'scalar' },
      ],
    }
    const name1 = getStatementName(query)
    const name2 = getStatementName(query)
    expect(name1).toBe(name2)
  })

  it('ignores arg values (only SQL and argTypes matter)', () => {
    const q1: SqlQuery = {
      sql: 'SELECT $1',
      args: [1],
      argTypes: [{ scalarType: 'int', arity: 'scalar' }],
    }
    const q2: SqlQuery = {
      sql: 'SELECT $1',
      args: [999],
      argTypes: [{ scalarType: 'int', arity: 'scalar' }],
    }
    expect(getStatementName(q1)).toBe(getStatementName(q2))
  })

  it('ignores dbType (only scalarType and arity matter)', () => {
    const q1: SqlQuery = {
      sql: 'SELECT $1',
      args: ['2026-01-01'],
      argTypes: [{ scalarType: 'datetime', dbType: 'DATE', arity: 'scalar' }],
    }
    const q2: SqlQuery = {
      sql: 'SELECT $1',
      args: ['2026-01-01T00:00:00Z'],
      argTypes: [{ scalarType: 'datetime', dbType: 'TIMESTAMPTZ', arity: 'scalar' }],
    }
    expect(getStatementName(q1)).toBe(getStatementName(q2))
  })

  it('produces different names for near-miss SQL (single character difference)', () => {
    const q1: SqlQuery = { sql: 'SELECT * FROM "User" WHERE id = $1', args: [], argTypes: [] }
    const q2: SqlQuery = { sql: 'SELECT * FROM "User" WHERE id = $2', args: [], argTypes: [] }
    expect(getStatementName(q1)).not.toBe(getStatementName(q2))
  })

  it('produces deterministic names for transaction control statements', () => {
    const begin: SqlQuery = { sql: 'BEGIN', args: [], argTypes: [] }
    const commit: SqlQuery = { sql: 'COMMIT', args: [], argTypes: [] }
    const rollback: SqlQuery = { sql: 'ROLLBACK', args: [], argTypes: [] }

    expect(getStatementName(begin)).toBe(getStatementName(begin))
    expect(getStatementName(commit)).toBe(getStatementName(commit))
    expect(getStatementName(rollback)).toBe(getStatementName(rollback))

    // Each should be distinct from the others
    const names = new Set([getStatementName(begin), getStatementName(commit), getStatementName(rollback)])
    expect(names.size).toBe(3)
  })
})

describe('PrismaPgAdapter passes statement name to client.query', () => {
  it('includes name property in the query config', async () => {
    const config: pg.PoolConfig = { user: 'test', password: 'test', database: 'test', port: 5432, host: 'localhost' }
    const factory = new PrismaPgAdapterFactory(config)
    const adapter = await factory.connect()

    const mockConnection = {
      on: vi.fn(),
      removeListener: vi.fn(),
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, fields: [] }),
      release: vi.fn(),
      listenerCount: vi.fn().mockReturnValue(1),
    }

    adapter['client'].connect = vi.fn().mockResolvedValue(mockConnection)

    const tx = await adapter.startTransaction()

    // The BEGIN query should have been sent with a name
    expect(mockConnection.query).toHaveBeenCalledTimes(1)
    const queryConfig = mockConnection.query.mock.calls[0][0]
    expect(queryConfig).toHaveProperty('name')
    expect(queryConfig.name).toMatch(/^p_[0-9a-f]{16}$/)
    expect(queryConfig.text).toBe('BEGIN')

    mockConnection.listenerCount.mockReturnValue(0)
    await tx.rollback()
    await adapter.dispose()
  })

  it('passes name through queryRaw and returns results correctly', async () => {
    const config: pg.PoolConfig = { user: 'test', password: 'test', database: 'test', port: 5432, host: 'localhost' }
    const factory = new PrismaPgAdapterFactory(config)
    const adapter = await factory.connect()

    const mockConnection = {
      on: vi.fn(),
      removeListener: vi.fn(),
      query: vi.fn().mockResolvedValue({
        rows: [[1, 'alice']],
        rowCount: 1,
        fields: [
          { name: 'id', dataTypeID: 23 },
          { name: 'name', dataTypeID: 25 },
        ],
      }),
      release: vi.fn(),
      listenerCount: vi.fn().mockReturnValue(1),
    }

    adapter['client'].connect = vi.fn().mockResolvedValue(mockConnection)

    const tx = await adapter.startTransaction()
    // Reset mock to clear the BEGIN call
    mockConnection.query.mockClear()

    mockConnection.query.mockResolvedValueOnce({
      rows: [[1, 'alice']],
      rowCount: 1,
      fields: [
        { name: 'id', dataTypeID: 23 },
        { name: 'name', dataTypeID: 25 },
      ],
    })

    const result = await tx.queryRaw({
      sql: 'SELECT $1, $2',
      args: [1, 'alice'],
      argTypes: [
        { scalarType: 'int', arity: 'scalar' },
        { scalarType: 'string', arity: 'scalar' },
      ],
    })

    // Verify name was passed
    const queryConfig = mockConnection.query.mock.calls[0][0]
    expect(queryConfig).toHaveProperty('name')
    expect(queryConfig.name).toMatch(/^p_[0-9a-f]{16}$/)

    // Verify results still parse correctly
    expect(result.columnNames).toEqual(['id', 'name'])
    expect(result.rows).toEqual([[1, 'alice']])

    mockConnection.listenerCount.mockReturnValue(0)
    await tx.rollback()
    await adapter.dispose()
  })

  it('passes the same name for identical queries', async () => {
    const config: pg.PoolConfig = { user: 'test', password: 'test', database: 'test', port: 5432, host: 'localhost' }
    const factory = new PrismaPgAdapterFactory(config)
    const adapter = await factory.connect()

    const mockConnection = {
      on: vi.fn(),
      removeListener: vi.fn(),
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, fields: [] }),
      release: vi.fn(),
      listenerCount: vi.fn().mockReturnValue(1),
    }

    adapter['client'].connect = vi.fn().mockResolvedValue(mockConnection)

    const tx = await adapter.startTransaction()
    mockConnection.query.mockClear()

    const query = {
      sql: 'SELECT $1',
      args: [1],
      argTypes: [{ scalarType: 'int' as const, arity: 'scalar' as const }],
    }

    mockConnection.query.mockResolvedValue({
      rows: [[1]],
      rowCount: 1,
      fields: [{ name: 'col', dataTypeID: 23 }],
    })

    await tx.queryRaw(query)
    await tx.queryRaw({ ...query, args: [999] }) // different value, same shape

    const name1 = mockConnection.query.mock.calls[0][0].name
    const name2 = mockConnection.query.mock.calls[1][0].name
    expect(name1).toBe(name2)

    mockConnection.listenerCount.mockReturnValue(0)
    await tx.rollback()
    await adapter.dispose()
  })
})

describe('PrismaPgAdapterFactory', () => {
  it('should subscribe to pool error events', async () => {
    const config: pg.PoolConfig = { user: 'test', password: 'test', database: 'test', port: 5432, host: 'localhost' }
    const factory = new PrismaPgAdapterFactory(config)
    const adapter = await factory.connect()

    const shutdownError = new DatabaseError('terminating connection due to administrator command', 116, 'error')
    shutdownError.severity = 'FATAL'
    shutdownError.code = '57P01'
    shutdownError.routine = 'ProcessInterrupts'
    shutdownError.line = '3197'
    shutdownError.file = 'postgres.c'

    adapter['client'].emit('error', shutdownError)
    await adapter.dispose()
    const debug = getLogs()
    expect(debug).toContain('terminating connection due to administrator command')
  })

  it('should call onPoolError when supplied', async () => {
    const config: pg.PoolConfig = { user: 'test', password: 'test', database: 'test', port: 5432, host: 'localhost' }
    const onPoolError = vi.fn()
    const factory = new PrismaPgAdapterFactory(config, { onPoolError })
    const adapter = await factory.connect()
    const error = new Error('Pool error')
    adapter['client'].emit('error', error)
    expect(onPoolError).toHaveBeenCalledWith(error)
    await adapter.dispose()
  })

  it('should add and remove error event listener when using an external Pool', async () => {
    const pool = new pg.Pool({ user: 'test', password: 'test', database: 'test', port: 5432, host: 'localhost' })
    pool.on('error', () => {})
    const factory = new PrismaPgAdapterFactory(pool)
    const adapter = await factory.connect()
    expect(adapter).toBeDefined()
    expect(adapter.adapterName).toBeDefined()
    expect(pool.listenerCount('error')).toEqual(2)
    await adapter.dispose()
    expect(pool.listenerCount('error')).toEqual(1)
    await pool.end()
  })

  it('should remove connection error listener after transaction commit', async () => {
    const config: pg.PoolConfig = { user: 'test', password: 'test', database: 'test', port: 5432, host: 'localhost' }
    const factory = new PrismaPgAdapterFactory(config)
    const adapter = await factory.connect()

    const mockConnection = {
      on: vi.fn(),
      removeListener: vi.fn(),
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
      listenerCount: vi.fn().mockReturnValue(1),
    }

    adapter['client'].connect = vi.fn().mockResolvedValue(mockConnection)

    const transaction = await adapter.startTransaction()
    expect(mockConnection.listenerCount('error')).toEqual(1)

    mockConnection.listenerCount.mockReturnValue(0)
    await transaction.commit()
    expect(mockConnection.removeListener).toHaveBeenCalledWith('error', expect.any(Function))
    expect(mockConnection.listenerCount('error')).toEqual(0)

    await adapter.dispose()
  })

  it('should remove connection error listener after transaction rollback', async () => {
    const config: pg.PoolConfig = { user: 'test', password: 'test', database: 'test', port: 5432, host: 'localhost' }
    const factory = new PrismaPgAdapterFactory(config)
    const adapter = await factory.connect()

    const mockConnection = {
      on: vi.fn(),
      removeListener: vi.fn(),
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
      listenerCount: vi.fn().mockReturnValue(1),
    }

    adapter['client'].connect = vi.fn().mockResolvedValue(mockConnection)

    const transaction = await adapter.startTransaction()
    expect(mockConnection.listenerCount('error')).toEqual(1)

    mockConnection.listenerCount.mockReturnValue(0)
    await transaction.rollback()
    expect(mockConnection.removeListener).toHaveBeenCalledWith('error', expect.any(Function))
    expect(mockConnection.listenerCount('error')).toEqual(0)

    await adapter.dispose()
  })
})
