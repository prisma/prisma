import { defaultTestConfig } from '@prisma/config'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const createPoolMock = vi.fn(() => ({ end: vi.fn() }))
const serveMock = vi.fn(() => ({ close: vi.fn() }))
const createPostgresJSExecutorMock = vi.fn(() => ({
  execute: vi.fn(),
}))
const serializeErrorMock = vi.fn((error: Error) => ({
  message: error.message,
  name: error.name,
}))

vi.mock('mysql2/promise', () => {
  return {
    createPool: createPoolMock,
  }
})

vi.mock('@hono/node-server', () => {
  return {
    serve: serveMock,
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
    serializeError: serializeErrorMock,
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
    createPostgresJSExecutor: createPostgresJSExecutorMock,
  }
})

describe('Studio MySQL URL compatibility', () => {
  beforeEach(() => {
    vi.resetModules()
    createPoolMock.mockClear()
    createPostgresJSExecutorMock.mockClear()
    serveMock.mockClear()
    serializeErrorMock.mockClear()
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

describe('Studio BFF', () => {
  beforeEach(() => {
    vi.resetModules()
    createPoolMock.mockClear()
    createPostgresJSExecutorMock.mockClear()
    serveMock.mockClear()
    serializeErrorMock.mockClear()
  })

  test('routes sql-lint requests to executor.lintSql', async () => {
    const lintSqlMock = vi.fn(() =>
      Promise.resolve([
        null,
        {
          diagnostics: [{ from: 0, message: 'lint-ok', severity: 'info', to: 1 }],
          schemaVersion: 'v1',
        },
      ]),
    )

    createPostgresJSExecutorMock.mockReturnValueOnce({
      execute: vi.fn(),
      lintSql: lintSqlMock,
    })

    const { Studio } = await import('../Studio')

    await Studio.new().parse(
      ['--browser', 'none', '--port', '5555', '--url', 'postgresql://user:password@localhost:5432/db'],
      defaultTestConfig(),
    )

    const response = await getBffResponse({
      procedure: 'sql-lint',
      schemaVersion: 'v1',
      sql: 'select 1',
    })

    expect(lintSqlMock).toHaveBeenCalledWith({
      schemaVersion: 'v1',
      sql: 'select 1',
    })
    expect(await response.json()).toEqual([
      null,
      {
        diagnostics: [{ from: 0, message: 'lint-ok', severity: 'info', to: 1 }],
        schemaVersion: 'v1',
      },
    ])
  })

  test('unwraps RPC-serialized sql-lint errors', async () => {
    createPostgresJSExecutorMock.mockReturnValueOnce({
      execute: vi.fn(),
      lintSql: vi.fn(() =>
        Promise.resolve([
          {
            '@@error': {
              message: 'relation "missing_table" does not exist',
              name: 'PostgresError',
            },
          },
        ]),
      ),
    })

    const { Studio } = await import('../Studio')

    await Studio.new().parse(
      ['--browser', 'none', '--port', '5555', '--url', 'postgresql://user:password@localhost:5432/db'],
      defaultTestConfig(),
    )

    const response = await getBffResponse({
      procedure: 'sql-lint',
      schemaVersion: 'v1',
      sql: 'select * from missing_table',
    })

    expect(serializeErrorMock).not.toHaveBeenCalled()
    expect(await response.json()).toEqual([
      {
        message: 'relation "missing_table" does not exist',
        name: 'PostgresError',
      },
    ])
  })
})

async function getBffResponse(body: unknown): Promise<Response> {
  const fetchHandler = serveMock.mock.calls.at(-1)?.[0]?.fetch as ((request: Request) => Promise<Response>) | undefined

  if (!fetchHandler) {
    throw new Error('Studio server fetch handler was not registered')
  }

  return fetchHandler(
    new Request('http://localhost:5555/bff', {
      body: JSON.stringify(body),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
    }),
  )
}
