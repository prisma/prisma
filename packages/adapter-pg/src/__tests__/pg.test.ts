import { getLogs } from '@prisma/debug'
import pg, { DatabaseError } from 'pg'
import { describe, expect, it, vi } from 'vitest'

import { PrismaPgAdapterFactory } from '../pg'

describe('PrismaPgAdapterFactory URL transformation', () => {
  // Helper to create a base64url-encoded api_key payload matching the local PPg format
  function encodeApiKey(databaseUrl: string, shadowDatabaseUrl = databaseUrl): string {
    return Buffer.from(JSON.stringify({ databaseUrl, shadowDatabaseUrl })).toString('base64url')
  }

  it('should extract databaseUrl from api_key for prisma+postgres://localhost URLs', () => {
    const apiKey = encodeApiKey('postgres://localhost:51216/postgres')
    const config: pg.PoolConfig = {
      connectionString: `prisma+postgres://localhost:51216/?api_key=${apiKey}`,
    }
    const factory = new PrismaPgAdapterFactory(config)
    expect(factory['config'].connectionString).toBe('postgres://localhost:51216/postgres')
  })

  it('should extract databaseUrl from api_key for prisma+postgres://127.0.0.1 URLs', () => {
    const apiKey = encodeApiKey('postgres://127.0.0.1:5432/mydb')
    const config: pg.PoolConfig = {
      connectionString: `prisma+postgres://127.0.0.1:5432/mydb?api_key=${apiKey}`,
    }
    const factory = new PrismaPgAdapterFactory(config)
    expect(factory['config'].connectionString).toBe('postgres://127.0.0.1:5432/mydb')
  })

  it('should extract databaseUrl from api_key for prisma+postgres://[::1] URLs', () => {
    const apiKey = encodeApiKey('postgres://[::1]:5432/mydb')
    const config: pg.PoolConfig = {
      connectionString: `prisma+postgres://[::1]:5432/mydb?api_key=${apiKey}`,
    }
    const factory = new PrismaPgAdapterFactory(config)
    expect(factory['config'].connectionString).toBe('postgres://[::1]:5432/mydb')
  })

  it('should fall back to simple URL transformation when api_key is not a valid payload', () => {
    const config: pg.PoolConfig = {
      connectionString: 'prisma+postgres://localhost:51216/?api_key=plain-text-key',
    }
    const factory = new PrismaPgAdapterFactory(config)
    expect(factory['config'].connectionString).toBe('postgres://localhost:51216/postgres')
  })

  it('should throw error for remote prisma+postgres:// URLs (Accelerate)', () => {
    const config: pg.PoolConfig = {
      connectionString: 'prisma+postgres://accelerate.prisma-data.net/db?api_key=test123',
    }
    expect(() => new PrismaPgAdapterFactory(config)).toThrow(
      'The "prisma+postgres://" protocol is not supported by @prisma/adapter-pg',
    )
  })

  it('should leave standard postgres:// URLs unchanged', () => {
    const config: pg.PoolConfig = {
      connectionString: 'postgres://user:password@localhost:5432/mydb',
    }
    const factory = new PrismaPgAdapterFactory(config)
    expect(factory['config'].connectionString).toBe('postgres://user:password@localhost:5432/mydb')
  })

  it('should leave standard postgresql:// URLs unchanged', () => {
    const config: pg.PoolConfig = {
      connectionString: 'postgresql://user:password@localhost:5432/mydb',
    }
    const factory = new PrismaPgAdapterFactory(config)
    expect(factory['config'].connectionString).toBe('postgresql://user:password@localhost:5432/mydb')
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
