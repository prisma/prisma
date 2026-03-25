import { describe, expect, test, vi } from 'vitest'
import * as mariadb from 'mariadb'

import {
  inferCapabilities,
  PrismaMariaDbAdapter,
  PrismaMariaDbAdapterFactory,
  rewriteConnectionString,
} from './mariadb'

// Mock the mariadb module
vi.mock('mariadb', () => ({
  createPool: vi.fn(),
}))

describe.each([
  ['8.0.12', { supportsRelationJoins: false }],
  ['8.0.13', { supportsRelationJoins: true }],
  ['8.1.0', { supportsRelationJoins: true }],
  ['8.4.5', { supportsRelationJoins: true }],
  ['8.4.13', { supportsRelationJoins: true }],
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

describe('credential sanitization', () => {
  test('connection string parse error should not expose password', async () => {
    const secretPassword = 'super_secret_password_12345'
    // IPv6 address in brackets - causes parse error in mariadb driver
    const connectionString = `mariadb://user:${secretPassword}@[64:ff9b::23be:d64c]/db`

    const factory = new PrismaMariaDbAdapterFactory(connectionString)

    try {
      await factory.connect()
      expect.fail('Expected connection to fail')
    } catch (error) {
      const errorMessage = String(error)
      expect(errorMessage).not.toContain(secretPassword)
    }
  })
})

describe('useTextProtocol option', () => {
  test.each([
    { useTextProtocol: false, expectedMethod: 'execute' },
    { useTextProtocol: undefined, expectedMethod: 'execute' },
    { useTextProtocol: true, expectedMethod: 'query' },
  ])(
    'should use client.$expectedMethod when useTextProtocol is $useTextProtocol',
    async ({ useTextProtocol, expectedMethod }) => {
      const mockClient = {
        execute: vi.fn().mockResolvedValue({ meta: [], affectedRows: 1 }),
        query: vi.fn().mockResolvedValue({ meta: [], affectedRows: 1 }),
      } as unknown as mariadb.Pool

      const adapter = new PrismaMariaDbAdapter(mockClient, { supportsRelationJoins: true }, { useTextProtocol })
      await adapter.executeRaw({ sql: 'SELECT 1', args: [], argTypes: [] })
      expect(mockClient[expectedMethod]).toHaveBeenCalledWith(expect.objectContaining({ sql: 'SELECT 1' }), [])
    },
  )
})

describe('PrismaMariaDbAdapterFactory constructor', () => {
  test('should create a config with prepareCacheLength set to 0 when config has no prepareCacheLength', async () => {
    const config = {}

    const mockCreatePool = vi.mocked(mariadb.createPool)
    mockCreatePool.mockReturnValue({
      query: vi.fn().mockResolvedValue([['8.0.13']]),
      end: vi.fn(),
    } as unknown as mariadb.Pool)

    const factory = new PrismaMariaDbAdapterFactory(config)
    await factory.connect()

    expect(mockCreatePool).toHaveBeenCalledWith(expect.objectContaining({ prepareCacheLength: 0 }))
    mockCreatePool.mockClear()
  })

  test('should preserve existing prepareCacheLength when config is object and prepareCacheLength is set', async () => {
    const config = {
      prepareCacheLength: 10,
    }

    const mockCreatePool = vi.mocked(mariadb.createPool)
    mockCreatePool.mockReturnValue({
      query: vi.fn().mockResolvedValue([['8.0.13']]),
      end: vi.fn(),
    } as unknown as mariadb.Pool)

    const factory = new PrismaMariaDbAdapterFactory(config)
    await factory.connect()

    expect(mockCreatePool).toHaveBeenCalledWith(expect.objectContaining({ prepareCacheLength: 10 }))
    mockCreatePool.mockClear()
  })
})
