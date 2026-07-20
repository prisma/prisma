import * as mariadb from 'mariadb'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

import {
  inferCapabilities,
  PrismaMariaDbAdapter,
  PrismaMariaDbAdapterFactory,
  rewriteConnectionString,
} from './mariadb'

describe('PrismaMariaDbAdapterFactory constructor', () => {
  beforeAll(() => {
    vi.mock('mariadb', () => ({
      createPool: vi.fn(),
    }))
  })

  afterAll(() => {
    vi.doUnmock('mariadb')
  })

  test.each([
    { config: {}, expected: expect.objectContaining({ prepareCacheLength: 0 }) },
    { config: 'mariadb://user:pass@localhost:3306/db', expected: expect.stringContaining('prepareCacheLength=0') },
  ])('should set prepareCacheLength to 0 when config has no prepareCacheLength', async ({ config, expected }) => {
    const mockCreatePool = vi.mocked(mariadb.createPool)
    mockCreatePool.mockReturnValue({
      query: vi.fn().mockResolvedValue([['8.0.13']]),
      end: vi.fn(),
    } as unknown as mariadb.Pool)

    const factory = new PrismaMariaDbAdapterFactory(config)
    await factory.connect()

    expect(mockCreatePool).toHaveBeenCalledWith(expected)
    mockCreatePool.mockClear()
  })

  test.each([
    { config: { prepareCacheLength: 10 }, expected: expect.objectContaining({ prepareCacheLength: 10 }) },
    {
      config: 'mariadb://user:pass@localhost:3306/db?prepareCacheLength=10',
      expected: expect.stringContaining('prepareCacheLength=10'),
    },
  ])('set when is set', async ({ config, expected }) => {
    const mockCreatePool = vi.mocked(mariadb.createPool)
    mockCreatePool.mockReturnValue({
      query: vi.fn().mockResolvedValue([['8.0.13']]),
      end: vi.fn(),
    } as unknown as mariadb.Pool)

    const factory = new PrismaMariaDbAdapterFactory(config)
    await factory.connect()

    expect(mockCreatePool).toHaveBeenCalledWith(expected)
    mockCreatePool.mockClear()
  })
})

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
    expect(rewriteConnectionString(new URL(input)).toString()).toBe(expected)
  })

  test('should preserve mariadb:// connection strings', () => {
    const input = 'mariadb://user:pass@localhost:3306/db'
    expect(rewriteConnectionString(new URL(input)).toString()).toBe(input)
  })
})

describe('useTextProtocol option', () => {
  const flagToMethod = {
    true: 'query',
    false: 'execute',
  }

  test.each([false, undefined, true].map((flag) => ({ flag, method: flagToMethod[String(!!flag)] })))(
    'should use client.$method when useTextProtocol is $flag',
    async ({ flag, method }) => {
      const mockClient = {
        execute: vi.fn().mockResolvedValue({ meta: [], affectedRows: 1 }),
        query: vi.fn().mockResolvedValue({ meta: [], affectedRows: 1 }),
      } as unknown as mariadb.Pool

      const adapter = new PrismaMariaDbAdapter(mockClient, { supportsRelationJoins: true }, { useTextProtocol: flag })
      await adapter.executeRaw({ sql: 'SELECT 1', args: [], argTypes: [] })
      expect(mockClient[method]).toHaveBeenCalledWith(expect.objectContaining({ sql: 'SELECT 1' }), [])

      expect(mockClient[flagToMethod[String(!flag)]]).not.toHaveBeenCalled()
    },
  )
})
