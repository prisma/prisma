import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { defaultTestConfig } from '@prisma/config'
import { HelpError } from '@prisma/internals'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { Bootstrap } from '../Bootstrap'

vi.mock('@prisma/management-api-sdk', () => {
  class AuthErrorMock extends Error {
    name = 'AuthError'
    constructor(
      message: string,
      public readonly refreshTokenInvalid = false,
    ) {
      super(message)
    }
  }
  return {
    createManagementApiClient: vi.fn(() => mockSdkClient),
    AuthError: AuthErrorMock,
  }
})

vi.mock('../../../management-api/auth', () => ({
  login: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../../management-api/auth-client', () => ({
  createAuthenticatedManagementAPI: vi.fn(() => ({ client: mockSdkClient })),
}))

vi.mock('../../../management-api/token-storage', () => ({
  FileTokenStorage: class {
    getTokens() {
      return Promise.resolve({ accessToken: 'stored_token', workspaceId: 'wksp_1' })
    }
  },
}))

vi.mock('@inquirer/prompts', () => ({
  select: vi.fn(),
  confirm: vi.fn(),
}))

vi.mock('checkpoint-client', () => ({
  getSignature: vi.fn(() => Promise.resolve('test-signature-123')),
}))

vi.mock('../../utils/nps/capture', () => ({
  PosthogEventCapture: class {
    async capture() {}
  },
}))

vi.mock('@prisma/migrate', () => ({
  MigrateDev: {
    new: () => ({
      parse: vi.fn(() => Promise.resolve('Migration completed')),
    }),
  },
  DbSeed: {
    new: () => ({
      parse: vi.fn(() => Promise.resolve('Seed completed')),
    }),
  },
}))

vi.mock('../../Init', () => ({
  Init: {
    new: () => ({
      parse: vi.fn(() => Promise.resolve('Prisma initialized')),
    }),
  },
}))

const mockSdkClient = {
  GET: vi.fn(),
  POST: vi.fn(),
}

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-bootstrap-'))
  mockSdkClient.GET.mockReset()
  mockSdkClient.POST.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function setupMockApiSuccess() {
  mockSdkClient.POST.mockResolvedValueOnce({
    data: {
      data: {
        id: 'conn_test',
        name: `dev-${os.hostname()}`,
        endpoints: {
          pooled: { connectionString: 'postgres://user:pass@db-pool.prisma.io:5432/postgres' },
          direct: { connectionString: 'postgres://user:pass@db.prisma.io:5432/postgres' },
        },
      },
    },
    error: undefined,
  })
}

describe('Bootstrap command — help and validation', () => {
  test('shows help with --help flag', async () => {
    const result = await Bootstrap.new().parse(['--help'], defaultTestConfig(), tmpDir)
    expect(result).toContain('prisma bootstrap')
  })

  test('returns error when --api-key is given without --database', async () => {
    const result = await Bootstrap.new().parse(['--api-key', 'test_key'], defaultTestConfig(), tmpDir)
    expect(result).toBeInstanceOf(HelpError)
    expect((result as HelpError).message).toContain('--database')
  })

  test('validates database ID format', async () => {
    const result = await Bootstrap.new().parse(
      ['--api-key', 'test_key', '--database', 'invalid-id'],
      defaultTestConfig(),
      tmpDir,
    )
    expect(result).toBeInstanceOf(HelpError)
    expect((result as HelpError).message).toContain('db_')
  })
})

describe('Bootstrap command — new project flow', () => {
  test('runs init when no schema exists, then links', async () => {
    const { confirm } = await import('@inquirer/prompts')
    vi.mocked(confirm).mockResolvedValue(false)

    setupMockApiSuccess()

    const result = await Bootstrap.new().parse(
      ['--api-key', 'test_key', '--database', 'db_abc123'],
      defaultTestConfig(),
      tmpDir,
    )

    expect(result).not.toBeInstanceOf(Error)
    const output = result as string
    expect(output).toContain('Bootstrap completed')
  })
})

describe('Bootstrap command — existing project flow', () => {
  test('skips init when schema already exists', async () => {
    const prismaDir = path.join(tmpDir, 'prisma')
    fs.mkdirSync(prismaDir, { recursive: true })
    fs.writeFileSync(path.join(prismaDir, 'schema.prisma'), 'datasource db { provider = "postgresql" }', 'utf-8')

    const { confirm } = await import('@inquirer/prompts')
    vi.mocked(confirm).mockResolvedValue(false)

    setupMockApiSuccess()

    const result = await Bootstrap.new().parse(
      ['--api-key', 'test_key', '--database', 'db_abc123'],
      defaultTestConfig(),
      tmpDir,
    )

    expect(result).not.toBeInstanceOf(Error)
    const output = result as string
    expect(output).toContain('Bootstrap completed')
    expect(output).toContain('Init')
  })
})

describe('Bootstrap command — consent gates', () => {
  test('skips migrate when user declines', async () => {
    const prismaDir = path.join(tmpDir, 'prisma')
    fs.mkdirSync(prismaDir, { recursive: true })
    fs.writeFileSync(
      path.join(prismaDir, 'schema.prisma'),
      `
datasource db { provider = "postgresql" }
model User { id Int @id }
`,
      'utf-8',
    )

    const { confirm } = await import('@inquirer/prompts')
    vi.mocked(confirm).mockResolvedValue(false)

    setupMockApiSuccess()

    const result = await Bootstrap.new().parse(
      ['--api-key', 'test_key', '--database', 'db_abc123'],
      defaultTestConfig(),
      tmpDir,
    )

    expect(result).not.toBeInstanceOf(Error)
    const output = result as string
    expect(output).toContain('skipped')
  })
})

describe('Bootstrap command — error handling', () => {
  test('returns error on API failure', async () => {
    mockSdkClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: { error: { code: 'unauthorized', message: 'Unauthorized' } },
    })

    const result = await Bootstrap.new().parse(
      ['--api-key', 'bad_key', '--database', 'db_abc123'],
      defaultTestConfig(),
      tmpDir,
    )

    expect(result).toBeInstanceOf(HelpError)
    expect((result as HelpError).message).toContain('Invalid credentials')
  })
})
