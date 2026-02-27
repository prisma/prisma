import { defaultTestConfig } from '@prisma/config'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const createPoolMock = vi.fn(() => ({ end: vi.fn() }))

vi.mock('mysql2/promise', () => {
  return {
    createPool: createPoolMock,
  }
})

vi.mock('@hono/node-server', () => {
  return {
    serve: vi.fn(() => ({ close: vi.fn() })),
  }
})

vi.mock('@prisma/studio-core/data/mysql2', () => {
  return {
    createMySQL2Executor: vi.fn(() => ({
      execute: vi.fn(),
    })),
  }
})

vi.mock('@prisma/studio-core/data/bff', () => {
  return {
    serializeError: vi.fn(() => ({ message: 'mock-error' })),
  }
})

vi.mock('@prisma/studio-core/data/node-sqlite', () => {
  return {
    createNodeSQLiteExecutor: vi.fn(() => ({
      execute: vi.fn(),
    })),
  }
})

vi.mock('@prisma/studio-core/data/postgresjs', () => {
  return {
    createPostgresJSExecutor: vi.fn(() => ({
      execute: vi.fn(),
    })),
  }
})

describe('Studio MySQL URL compatibility', () => {
  beforeEach(() => {
    vi.resetModules()
    createPoolMock.mockClear()
  })

  test('converts sslaccept=strict to mysql2 ssl JSON', async () => {
    const { Studio } = await import('../Studio')

    await Studio.new().parse(
      [
        '--browser',
        'none',
        '--port',
        '5555',
        '--url',
        'mysql://user:password@aws.connect.psdb.cloud/db?sslaccept=strict',
      ],
      defaultTestConfig(),
    )

    expect(createPoolMock).toHaveBeenCalledTimes(1)

    const passedUrl = new URL(createPoolMock.mock.calls[0][0])

    expect(passedUrl.searchParams.get('sslaccept')).toBeNull()
    expect(passedUrl.searchParams.get('ssl')).toBe('{"rejectUnauthorized":true}')
  })

  test('maps connection_limit to mysql2 connectionLimit', async () => {
    const { Studio } = await import('../Studio')

    await Studio.new().parse(
      [
        '--browser',
        'none',
        '--port',
        '5555',
        '--url',
        'mysql://user:password@aws.connect.psdb.cloud/db?connection_limit=7',
      ],
      defaultTestConfig(),
    )

    expect(createPoolMock).toHaveBeenCalledTimes(1)

    const passedUrl = new URL(createPoolMock.mock.calls[0][0])

    expect(passedUrl.searchParams.get('connection_limit')).toBeNull()
    expect(passedUrl.searchParams.get('connectionLimit')).toBe('7')
  })

  test('converts sslaccept=accept_invalid_certs to mysql2 ssl JSON', async () => {
    const { Studio } = await import('../Studio')

    await Studio.new().parse(
      [
        '--browser',
        'none',
        '--port',
        '5555',
        '--url',
        'mysql://user:password@aws.connect.psdb.cloud/db?sslaccept=accept_invalid_certs',
      ],
      defaultTestConfig(),
    )

    expect(createPoolMock).toHaveBeenCalledTimes(1)

    const passedUrl = new URL(createPoolMock.mock.calls[0][0])

    expect(passedUrl.searchParams.get('sslaccept')).toBeNull()
    expect(passedUrl.searchParams.get('ssl')).toBe('{"rejectUnauthorized":false}')
  })
})
