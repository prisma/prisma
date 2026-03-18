import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { defaultTestConfig } from '@prisma/config'
import { HelpError } from '@prisma/internals'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { Link } from '../Link'

const mockFetch = vi.fn()
const originalFetch = globalThis.fetch

let tmpDir: string

beforeEach(() => {
  globalThis.fetch = mockFetch
  vi.stubEnv('PRISMA_MANAGEMENT_API_URL', 'https://api.test.prisma.io')
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-link-integ-'))
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.unstubAllEnvs()
  mockFetch.mockReset()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function setupMockApiSuccess() {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            id: 'conn_test',
            name: `dev-${os.hostname()}`,
            endpoints: {
              pooled: { connectionString: 'prisma+postgres://pooled-url' },
              direct: { connectionString: 'postgres://direct-url' },
            },
          },
        }),
    })
}

describe('Link command', () => {
  test('shows help with --help flag', async () => {
    const result = await Link.new().parse(['--help'], defaultTestConfig(), tmpDir)
    expect(result).toContain('prisma postgres link')
  })

  test('returns error when --api-key is missing', async () => {
    delete process.env.PRISMA_API_KEY
    const result = await Link.new().parse(['--database', 'db_abc'], defaultTestConfig(), tmpDir)
    expect(result).toBeInstanceOf(HelpError)
    expect((result as HelpError).message).toContain('--api-key')
  })

  test('returns error when --database is missing', async () => {
    const result = await Link.new().parse(['--api-key', 'test_key'], defaultTestConfig(), tmpDir)
    expect(result).toBeInstanceOf(HelpError)
    expect((result as HelpError).message).toContain('--database')
  })

  test('validates database ID format', async () => {
    const result = await Link.new().parse(
      ['--api-key', 'test_key', '--database', 'invalid-id'],
      defaultTestConfig(),
      tmpDir,
    )
    expect(result).toBeInstanceOf(HelpError)
    expect((result as HelpError).message).toContain('db_')
  })

  test('links successfully and creates .env', async () => {
    setupMockApiSuccess()

    const result = await Link.new().parse(
      ['--api-key', 'test_key', '--database', 'db_abc123'],
      defaultTestConfig(),
      tmpDir,
    )

    expect(result).not.toBeInstanceOf(Error)
    const output = result as string
    expect(output).toContain('linked successfully')

    const envContent = fs.readFileSync(path.join(tmpDir, '.env'), 'utf-8')
    expect(envContent).toContain("DATABASE_URL='prisma+postgres://pooled-url'")
    expect(envContent).toContain("DIRECT_URL='postgres://direct-url'")
  })

  test('shows next steps for schema with models', async () => {
    setupMockApiSuccess()
    const prismaDir = path.join(tmpDir, 'prisma')
    fs.mkdirSync(prismaDir, { recursive: true })
    fs.writeFileSync(
      path.join(prismaDir, 'schema.prisma'),
      `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id    Int    @id @default(autoincrement())
  name  String
}
`,
      'utf-8',
    )

    const result = await Link.new().parse(
      ['--api-key', 'test_key', '--database', 'db_abc123'],
      defaultTestConfig(),
      tmpDir,
    )

    const output = result as string
    expect(output).toContain('prisma generate')
    expect(output).toContain('prisma migrate dev')
  })

  test('shows next steps for schema without models', async () => {
    setupMockApiSuccess()

    const result = await Link.new().parse(
      ['--api-key', 'test_key', '--database', 'db_abc123'],
      defaultTestConfig(),
      tmpDir,
    )

    const output = result as string
    expect(output).toContain('Define your data model')
  })

  test('uses PRISMA_API_KEY env var when --api-key flag is omitted', async () => {
    vi.stubEnv('PRISMA_API_KEY', 'env_api_key')
    setupMockApiSuccess()

    const result = await Link.new().parse(['--database', 'db_abc123'], defaultTestConfig(), tmpDir)

    expect(result).not.toBeInstanceOf(Error)
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer env_api_key')
  })

  test('returns error on API failure from POST', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      })

    const result = await Link.new().parse(
      ['--api-key', 'bad_key', '--database', 'db_abc123'],
      defaultTestConfig(),
      tmpDir,
    )

    expect(result).toBeInstanceOf(HelpError)
    expect((result as HelpError).message).toContain('Invalid API key')
  })

  test('returns error on 401 from list connections', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    })

    const result = await Link.new().parse(
      ['--api-key', 'bad_key', '--database', 'db_abc123'],
      defaultTestConfig(),
      tmpDir,
    )

    expect(result).toBeInstanceOf(HelpError)
    expect((result as HelpError).message).toContain('Invalid API key')
  })
})
