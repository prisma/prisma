import * as mariadb from 'mariadb'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { inferCapabilities, PrismaMariaDbAdapterFactory, rewriteConnectionString } from './mariadb'

// Mock the mariadb module
vi.mock('mariadb', () => ({
  createPool: vi.fn(),
}))

describe.each([
  ['8.0.12', { supportsRelationJoins: false }],
  ['8.0.13', { supportsRelationJoins: true }],
  ['11.4.7-MariaDB-ubu2404', { supportsRelationJoins: false }],
])('infer capabilities for %s', (version, capabilities) => {
  test(`inferCapabilities(${version})`, () => {
    expect(inferCapabilities(version)).toEqual(capabilities)
  })
})

describe('rewriteConnectionString', () => {
  test('should rewrite mysql:// to mariadb://', () => {
    const input = 'mysql://user:password@localhost:3306/database?ssl=true&connectionLimit=10&charset=utf8mb4'
    const expected = 'mariadb://user:password@localhost:3306/database?ssl=true&connectionLimit=10&charset=utf8mb4'
    expect(rewriteConnectionString(input)).toBe(expected)
  })

  test('should preserve mariadb:// connection strings', () => {
    const input = 'mariadb://user:pass@localhost:3306/db'
    expect(rewriteConnectionString(input)).toBe(input)
  })

  test('should preserve configuration objects', () => {
    const config = {
      host: 'localhost',
      port: 3306,
      user: 'user',
      password: 'pass',
      database: 'db',
    }
    expect(rewriteConnectionString(config)).toBe(config)
  })
})

describe('PrismaMariaDbAdapterFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should accept a pool instance directly', async () => {
    const mockPool = {
      getConnection: vi.fn(),
      end: vi.fn(),
      query: vi.fn().mockResolvedValue([['8.0.13']]),
    }

    const factory = new PrismaMariaDbAdapterFactory(mockPool as any)
    const adapter = await factory.connect()

    expect(adapter).toBeDefined()
    expect(mockPool.query).toHaveBeenCalledWith({
      sql: 'SELECT VERSION()',
      rowsAsArray: true,
    })
  })

  test('should accept config object', () => {
    const config = {
      host: 'localhost',
      port: 3306,
      user: 'user',
      password: 'pass',
      database: 'db',
    }

    const factory = new PrismaMariaDbAdapterFactory(config)
    expect(factory).toBeDefined()
  })

  test('should accept mysql:// connection string', () => {
    const connectionString = 'mysql://user:pass@localhost:3306/db'
    const factory = new PrismaMariaDbAdapterFactory(connectionString)
    expect(factory).toBeDefined()
  })

  test('should accept mariadb:// connection string', () => {
    const connectionString = 'mariadb://user:pass@localhost:3306/db'
    const factory = new PrismaMariaDbAdapterFactory(connectionString)
    expect(factory).toBeDefined()
  })

  test('should not dispose external pool by default', async () => {
    const mockPool = {
      getConnection: vi.fn(),
      end: vi.fn(),
      query: vi.fn().mockResolvedValue([['8.0.13']]),
    }

    const factory = new PrismaMariaDbAdapterFactory(mockPool as any)
    const adapter = await factory.connect()
    await adapter.dispose()

    expect(mockPool.end).not.toHaveBeenCalled()
  })

  test('should dispose external pool when disposeExternalPool is true', async () => {
    const mockPool = {
      getConnection: vi.fn(),
      end: vi.fn(),
      query: vi.fn().mockResolvedValue([['8.0.13']]),
    }

    const factory = new PrismaMariaDbAdapterFactory(mockPool as any, { disposeExternalPool: true })
    const adapter = await factory.connect()
    await adapter.dispose()

    expect(mockPool.end).toHaveBeenCalled()
  })

  test('should throw error when calling connect() multiple times with external pool and disposeExternalPool: true', async () => {
    const mockPool = {
      getConnection: vi.fn(),
      end: vi.fn(),
      query: vi.fn().mockResolvedValue([['8.0.13']]),
    }

    const factory = new PrismaMariaDbAdapterFactory(mockPool as any, { disposeExternalPool: true })
    const adapter = await factory.connect()
    await adapter.dispose()

    // Should throw when trying to connect again
    await expect(factory.connect()).rejects.toThrow(
      'Cannot call connect() multiple times when using an external pool with `disposeExternalPool: true`',
    )
  })

  test('should allow multiple connect() calls when disposeExternalPool is false', async () => {
    const mockPool = {
      getConnection: vi.fn(),
      end: vi.fn(),
      query: vi.fn().mockResolvedValue([['8.0.13']]),
    }

    const factory = new PrismaMariaDbAdapterFactory(mockPool as any, { disposeExternalPool: false })

    const adapter1 = await factory.connect()
    await adapter1.dispose()

    // Should not throw when connecting again
    const adapter2 = await factory.connect()
    expect(adapter2).toBeDefined()

    // Both adapters should use the same pool
    expect(adapter1.underlyingDriver()).toBe(adapter2.underlyingDriver())

    // Pool should not be disposed
    expect(mockPool.end).not.toHaveBeenCalled()
  })

  test('should allow multiple connect() calls with config', async () => {
    const mockPool = {
      getConnection: vi.fn(),
      end: vi.fn(),
      query: vi.fn().mockResolvedValue([['8.0.13']]),
    }

    // Mock createPool to return our mock pool
    vi.mocked(mariadb.createPool).mockReturnValue(mockPool as any)

    const config = {
      host: 'localhost',
      port: 3306,
      user: 'user',
      password: 'pass',
      database: 'db',
    }

    const factory = new PrismaMariaDbAdapterFactory(config)

    const adapter1 = await factory.connect()
    expect(adapter1).toBeDefined()
    expect(mariadb.createPool).toHaveBeenCalledTimes(1)
    expect(mariadb.createPool).toHaveBeenCalledWith(config)

    await adapter1.dispose()
    expect(mockPool.end).toHaveBeenCalledTimes(1)

    // Should create a new pool for the second connect
    const adapter2 = await factory.connect()
    expect(adapter2).toBeDefined()
    expect(mariadb.createPool).toHaveBeenCalledTimes(2)

    await adapter2.dispose()
    expect(mockPool.end).toHaveBeenCalledTimes(2)
  })

  test('should allow multiple connect() calls with connection string', async () => {
    const mockPool = {
      getConnection: vi.fn(),
      end: vi.fn(),
      query: vi.fn().mockResolvedValue([['8.0.13']]),
    }

    // Mock createPool to return our mock pool
    vi.mocked(mariadb.createPool).mockReturnValue(mockPool as any)

    const connectionString = 'mysql://user:pass@localhost:3306/db'
    const factory = new PrismaMariaDbAdapterFactory(connectionString)

    const adapter1 = await factory.connect()
    expect(adapter1).toBeDefined()
    expect(mariadb.createPool).toHaveBeenCalledTimes(1)
    // Should have converted mysql:// to mariadb://
    expect(mariadb.createPool).toHaveBeenCalledWith('mariadb://user:pass@localhost:3306/db')

    await adapter1.dispose()
    expect(mockPool.end).toHaveBeenCalledTimes(1)

    // Should create a new pool for the second connect
    const adapter2 = await factory.connect()
    expect(adapter2).toBeDefined()
    expect(mariadb.createPool).toHaveBeenCalledTimes(2)

    await adapter2.dispose()
    expect(mockPool.end).toHaveBeenCalledTimes(2)
  })
})
