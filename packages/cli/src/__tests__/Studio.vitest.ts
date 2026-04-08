import { defaultTestConfig } from '@prisma/config'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const createPoolMock = vi.fn(() => ({ end: vi.fn() }))
const readFileMock = vi.fn((filePath: string) => {
  if (/[\\/]studio\.js$/.test(filePath)) {
    return Promise.resolve('window.__studioBundle = true;')
  }

  if (/[\\/]studio\.css$/.test(filePath)) {
    return Promise.resolve('.ps { color: black; }')
  }

  const error = new Error(`File not found: ${filePath}`) as Error & { code?: string }
  error.code = 'ENOENT'
  return Promise.reject(error)
})
const startStudioServerMock = vi.fn(() => ({ close: vi.fn() }))
const createPostgresJSExecutorMock = vi.fn(() => ({
  execute: vi.fn(),
}))
const serializeErrorMock = vi.fn((error: unknown) => {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
    }
  }

  return {
    message: JSON.stringify(error),
    name: 'UnknownError',
  }
})

vi.mock('mysql2/promise', () => {
  return {
    createPool: createPoolMock,
  }
})

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()

  return {
    ...actual,
    readFile: readFileMock,
  }
})

vi.mock('../studio-server', () => {
  return {
    startStudioServer: startStudioServerMock,
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
    readFileMock.mockClear()
    startStudioServerMock.mockClear()
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
    readFileMock.mockClear()
    startStudioServerMock.mockClear()
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

    await startStudioBff({
      execute: vi.fn(),
      lintSql: lintSqlMock,
    })

    const response = await getBffResponse({
      procedure: 'sql-lint',
      schemaVersion: 'v1',
      sql: 'select 1',
    })

    expect(lintSqlMock).toHaveBeenCalledWith({
      schemaVersion: 'v1',
      sql: 'select 1',
    })
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(await response.json()).toEqual([
      null,
      {
        diagnostics: [{ from: 0, message: 'lint-ok', severity: 'info', to: 1 }],
        schemaVersion: 'v1',
      },
    ])
  })

  test('unwraps RPC-serialized sql-lint errors', async () => {
    await startStudioBff({
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

  test('passes through top-level serialized sql-lint errors', async () => {
    await startStudioBff({
      execute: vi.fn(),
      lintSql: vi.fn(() =>
        Promise.resolve([
          {
            message: 'syntax error at or near "from"',
            name: 'PostgresError',
          },
        ]),
      ),
    })

    const response = await getBffResponse({
      procedure: 'sql-lint',
      schemaVersion: 'v1',
      sql: 'select from',
    })

    expect(serializeErrorMock).not.toHaveBeenCalled()
    expect(await response.json()).toEqual([
      {
        message: 'syntax error at or near "from"',
        name: 'PostgresError',
      },
    ])
  })

  test('unwraps nested serialized sql-lint errors', async () => {
    await startStudioBff({
      execute: vi.fn(),
      lintSql: vi.fn(() =>
        Promise.resolve([
          {
            error: {
              message: 'relation "users" does not exist',
              name: 'PostgresError',
            },
          },
        ]),
      ),
    })

    const response = await getBffResponse({
      procedure: 'sql-lint',
      schemaVersion: 'v1',
      sql: 'select * from users',
    })

    expect(serializeErrorMock).not.toHaveBeenCalled()
    expect(await response.json()).toEqual([
      {
        message: 'relation "users" does not exist',
        name: 'PostgresError',
      },
    ])
  })

  test('falls back to serializeError for unknown sql-lint error shapes', async () => {
    await startStudioBff({
      execute: vi.fn(),
      lintSql: vi.fn(() =>
        Promise.resolve([
          {
            message: 'missing name field',
          } as never,
        ]),
      ),
    })

    const response = await getBffResponse({
      procedure: 'sql-lint',
      schemaVersion: 'v1',
      sql: 'select 1',
    })

    expect(serializeErrorMock).toHaveBeenCalledTimes(1)
    expect(await response.json()).toEqual([
      {
        message: '{"message":"missing name field"}',
        name: 'UnknownError',
      },
    ])
  })

  test('routes transaction requests to executor.executeTransaction', async () => {
    const executeTransactionMock = vi.fn(() => Promise.resolve([null, [[{ id: 1 }], [{ id: 2 }]]]))

    const queries = [
      { parameters: [], sql: 'select 1 as id' },
      { parameters: [], sql: 'select 2 as id' },
    ]

    await startStudioBff({
      execute: vi.fn(),
      executeTransaction: executeTransactionMock,
    })

    const response = await getBffResponse({
      procedure: 'transaction',
      queries,
    })

    expect(executeTransactionMock).toHaveBeenCalledWith(queries)
    expect(await response.json()).toEqual([null, [[{ id: 1 }], [{ id: 2 }]]])
  })

  test('serves the Prisma logo as the favicon', async () => {
    await startStudioBff({
      execute: vi.fn(),
    })

    const response = await getServerResponse('http://localhost:5555/favicon.ico')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/svg+xml')
    expect(await response.text()).toContain('<svg')
  })

  test('serves the bundled Studio HTML shell without CDN dependencies', async () => {
    await startStudioBff({
      execute: vi.fn(),
    })

    const response = await getServerResponse('http://localhost:5555/')
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(html).toContain('<link rel="icon"')
    expect(html).toContain('<link rel="stylesheet" href="/studio.css">')
    expect(html).toContain('<script type="module" src="/studio.js"></script>')
    expect(html).toContain('window.__STUDIO_CONFIG__ = {"adapter":"postgres"};')
    expect(html).not.toContain('importmap')
    expect(html).not.toContain('esm.sh')
    expect(html).not.toContain('cdn.jsdelivr.net')
    expect(html).not.toContain('/adapter.js')
  })

  test('serves the bundled Studio JavaScript and CSS assets', async () => {
    await startStudioBff({
      execute: vi.fn(),
    })

    const [jsResponse, cssResponse] = await Promise.all([
      getServerResponse('http://localhost:5555/studio.js'),
      getServerResponse('http://localhost:5555/studio.css'),
    ])

    expect(jsResponse.status).toBe(200)
    expect(jsResponse.headers.get('content-type')).toBe('application/javascript')
    expect(await jsResponse.text()).toBe('window.__studioBundle = true;')

    expect(cssResponse.status).toBe(200)
    expect(cssResponse.headers.get('content-type')).toBe('text/css')
    expect(await cssResponse.text()).toBe('.ps { color: black; }')
  })

  test('responds to OPTIONS requests with CORS preflight headers', async () => {
    await startStudioBff({
      execute: vi.fn(),
    })

    const response = await getServerResponse('http://localhost:5555/bff', {
      method: 'OPTIONS',
    })

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(response.headers.get('access-control-allow-methods')).toBe('GET, HEAD, POST, OPTIONS')
    expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type')
    expect(await response.text()).toBe('')
  })

  test('no longer serves adapter.js', async () => {
    await startStudioBff({
      execute: vi.fn(),
    })

    const response = await getServerResponse('http://localhost:5555/adapter.js')

    expect(response.status).toBe(404)
  })
})

async function getBffResponse(body: unknown): Promise<Response> {
  return getServerResponse('http://localhost:5555/bff', {
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  })
}

async function getServerResponse(input: string, init?: RequestInit): Promise<Response> {
  const fetchHandler = startStudioServerMock.mock.calls.at(-1)?.[0]?.handler as
    | ((request: Request) => Promise<Response>)
    | undefined

  if (!fetchHandler) {
    throw new Error('Studio server fetch handler was not registered')
  }

  return fetchHandler(new Request(input, init))
}

async function startStudioBff(executor: {
  execute: ReturnType<typeof vi.fn>
  executeTransaction?: ReturnType<typeof vi.fn>
  lintSql?: ReturnType<typeof vi.fn>
}) {
  createPostgresJSExecutorMock.mockReturnValueOnce(executor)

  const { Studio } = await import('../Studio')

  await Studio.new().parse(
    ['--browser', 'none', '--port', '5555', '--url', 'postgresql://user:password@localhost:5432/db'],
    defaultTestConfig(),
  )
}
