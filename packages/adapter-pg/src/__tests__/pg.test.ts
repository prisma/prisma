import { getLogs } from '@prisma/debug'
import pg, { DatabaseError } from 'pg'
import { describe, expect, it, vi } from 'vitest'

import { PrismaPgAdapterFactory } from '../pg'

// Helper to get test database config from environment
function getTestConfig(): pg.PoolConfig {
  const uri = process.env.TEST_POSTGRES_URI
  if (!uri) {
    throw new Error('TEST_POSTGRES_URI environment variable is required to run these tests')
  }
  const url = new URL(uri)
  return {
    host: url.hostname,
    port: parseInt(url.port || '5432'),
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1), // Remove leading '/'
  }
}

const testConfig = getTestConfig()

describe('PrismaPgAdapterFactory', () => {
  it('should subscribe to pool error events', async () => {
    const factory = new PrismaPgAdapterFactory(testConfig)
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
    const onPoolError = vi.fn()
    const factory = new PrismaPgAdapterFactory(testConfig, { onPoolError })
    const adapter = await factory.connect()
    const error = new Error('Pool error')
    adapter['client'].emit('error', error)
    expect(onPoolError).toHaveBeenCalledWith(error)
    await adapter.dispose()
  })

  it('should add and remove error event listener when using an external Pool', async () => {
    const pool = new pg.Pool(testConfig)
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
    const factory = new PrismaPgAdapterFactory(testConfig)
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
    const factory = new PrismaPgAdapterFactory(testConfig)
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

  it('should throw an error when database is unreachable during connect', async () => {
    // Use an unreachable host and port to simulate offline database
    const config: pg.PoolConfig = {
      user: 'test',
      password: 'test',
      database: 'test',
      host: '192.0.2.1', // TEST-NET-1 - reserved for documentation, guaranteed to be unreachable
      port: 54321, // Non-standard port unlikely to have a service
      connectionTimeoutMillis: 100, // Short timeout to make test faster
    }
    const factory = new PrismaPgAdapterFactory(config)

    // connect() should throw an error when the database is unreachable
    await expect(factory.connect()).rejects.toThrow()
  })

  it('should throw an error when database connection fails with external pool', async () => {
    const mockPool = new pg.Pool({
      user: 'test',
      password: 'test',
      database: 'test',
      host: 'localhost',
      port: 5432,
    })
    try {
      // Mock the query method to simulate connection failure
      mockPool.query = vi.fn().mockRejectedValue(new Error('Connection refused'))

      const factory = new PrismaPgAdapterFactory(mockPool)

      // connect() should throw an error when the initial connection test fails
      await expect(factory.connect()).rejects.toThrow('Connection refused')
    } finally {
      await mockPool.end()
    }
  })
})
