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
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () =>
      Promise.resolve({
        data: {
          id: 'conn_test',
          name: `dev-${os.hostname()}`,
          endpoints: {
            pooled: { connectionString: 'postgres://user:pass@db-pool.prisma.io:5432/postgres' },
            direct: { connectionString: 'postgres://user:pass@db.prisma.io:5432/postgres' },
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

  test('links successfully and writes direct connection to DATABASE_URL', async () => {
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
    expect(envContent).toContain("DATABASE_URL='postgres://user:pass@db.prisma.io:5432/postgres'")
    expect(envContent).not.toContain('DIRECT_URL')
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

  test('returns error on API failure', async () => {
    mockFetch.mockResolvedValueOnce({
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

  test('skips API call when already linked', async () => {
    fs.writeFileSync(
      path.join(tmpDir, '.env'),
      "DATABASE_URL='postgres://user:pass@db.prisma.io:5432/postgres'\n",
      'utf-8',
    )

    const result = await Link.new().parse(
      ['--api-key', 'test_key', '--database', 'db_abc123'],
      defaultTestConfig(),
      tmpDir,
    )

    expect(result).toContain('already linked')
    expect(result).toContain('--force')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('re-links when --force is used on already linked project', async () => {
    fs.writeFileSync(
      path.join(tmpDir, '.env'),
      "DATABASE_URL='postgres://user:pass@db.prisma.io:5432/postgres'\n",
      'utf-8',
    )
    setupMockApiSuccess()

    const result = await Link.new().parse(
      ['--api-key', 'test_key', '--database', 'db_abc123', '--force'],
      defaultTestConfig(),
      tmpDir,
    )

    expect(result).not.toBeInstanceOf(Error)
    const output = result as string
    expect(output).toContain('linked successfully')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
