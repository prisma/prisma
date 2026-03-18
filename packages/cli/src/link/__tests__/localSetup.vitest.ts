import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { checkGitignore, formatEnvSummary, upsertEnvFile, writeLocalFiles } from '../localSetup'
import type { ConnectionResult } from '../managementApi'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-link-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('upsertEnvFile', () => {
  test('creates .env when it does not exist', () => {
    const envPath = path.join(tmpDir, '.env')
    const result = upsertEnvFile(envPath, {
      DATABASE_URL: 'postgres://localhost:5432/db',
    })

    expect(result.created).toBe(true)
    expect(result.added).toEqual(['DATABASE_URL'])
    expect(result.updated).toEqual([])

    const content = fs.readFileSync(envPath, 'utf-8')
    expect(content).toContain("DATABASE_URL='postgres://localhost:5432/db'")
  })

  test('appends new keys to existing .env', () => {
    const envPath = path.join(tmpDir, '.env')
    fs.writeFileSync(envPath, 'EXISTING_VAR="hello"\n', 'utf-8')

    const result = upsertEnvFile(envPath, {
      DATABASE_URL: 'postgres://localhost:5432/db',
    })

    expect(result.created).toBe(false)
    expect(result.added).toEqual(['DATABASE_URL'])
    expect(result.updated).toEqual([])

    const content = fs.readFileSync(envPath, 'utf-8')
    expect(content).toContain('EXISTING_VAR="hello"')
    expect(content).toContain("DATABASE_URL='postgres://localhost:5432/db'")
  })

  test('updates existing keys in .env', () => {
    const envPath = path.join(tmpDir, '.env')
    fs.writeFileSync(envPath, 'DATABASE_URL="old-value"\n', 'utf-8')

    const result = upsertEnvFile(envPath, {
      DATABASE_URL: 'postgres://localhost:5432/new-db',
    })

    expect(result.created).toBe(false)
    expect(result.updated).toEqual(['DATABASE_URL'])
    expect(result.added).toEqual([])

    const content = fs.readFileSync(envPath, 'utf-8')
    expect(content).toContain("DATABASE_URL='postgres://localhost:5432/new-db'")
    expect(content).not.toContain('old-value')
  })

  test('handles multiple entries (update + add)', () => {
    const envPath = path.join(tmpDir, '.env')
    fs.writeFileSync(envPath, 'DATABASE_URL="old-value"\n', 'utf-8')

    const result = upsertEnvFile(envPath, {
      DATABASE_URL: 'new-pooled-url',
      DIRECT_URL: 'new-direct-url',
    })

    expect(result.updated).toEqual(['DATABASE_URL'])
    expect(result.added).toEqual(['DIRECT_URL'])

    const content = fs.readFileSync(envPath, 'utf-8')
    expect(content).toContain("DATABASE_URL='new-pooled-url'")
    expect(content).toContain("DIRECT_URL='new-direct-url'")
  })

  test('does not expand $ in values when using single quotes', () => {
    const envPath = path.join(tmpDir, '.env')
    const result = upsertEnvFile(envPath, {
      DATABASE_URL: 'prisma+postgres://accelerate.prisma-data.net/?api_key=$ecret',
    })

    expect(result.created).toBe(true)
    const content = fs.readFileSync(envPath, 'utf-8')
    expect(content).toContain("DATABASE_URL='prisma+postgres://accelerate.prisma-data.net/?api_key=$ecret'")
  })
})

describe('checkGitignore', () => {
  test('returns no-file when .gitignore does not exist', () => {
    expect(checkGitignore(tmpDir)).toBe('no-file')
  })

  test('returns ok when .gitignore contains .env', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules\n.env\n', 'utf-8')
    expect(checkGitignore(tmpDir)).toBe('ok')
  })

  test('returns ok when .gitignore contains /.env', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), '/.env\n', 'utf-8')
    expect(checkGitignore(tmpDir)).toBe('ok')
  })

  test('returns missing-entry when .gitignore does not contain .env', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules\ndist\n', 'utf-8')
    expect(checkGitignore(tmpDir)).toBe('missing-entry')
  })
})

describe('writeLocalFiles', () => {
  test('writes connection strings to .env', () => {
    const connection: ConnectionResult = {
      connectionString: 'prisma+postgres://accelerate.prisma-data.net/?api_key=abc',
      directConnectionString: 'postgres://aws-us-east-1.prisma-data.net:5432/db',
    }

    const result = writeLocalFiles(tmpDir, connection)

    expect(result.env.created).toBe(true)

    const envContent = fs.readFileSync(path.join(tmpDir, '.env'), 'utf-8')
    expect(envContent).toContain('DATABASE_URL=')
    expect(envContent).toContain('DIRECT_URL=')
  })

  test('writes only DATABASE_URL when no direct connection', () => {
    const connection: ConnectionResult = {
      connectionString: 'prisma+postgres://accelerate.prisma-data.net/?api_key=abc',
      directConnectionString: null,
    }

    const result = writeLocalFiles(tmpDir, connection)

    const envContent = fs.readFileSync(path.join(tmpDir, '.env'), 'utf-8')
    expect(envContent).toContain('DATABASE_URL=')
    expect(envContent).not.toContain('DIRECT_URL=')
  })
})

describe('formatEnvSummary', () => {
  test('reports created .env', () => {
    const summary = formatEnvSummary({
      env: { created: true, updated: [], added: ['DATABASE_URL'] },
      gitignoreStatus: 'ok',
    })
    expect(summary).toContain('Created')
    expect(summary).toContain('.env')
  })

  test('includes gitignore warning when entry is missing', () => {
    const summary = formatEnvSummary({
      env: { created: true, updated: [], added: ['DATABASE_URL'] },
      gitignoreStatus: 'missing-entry',
    })
    expect(summary).toContain('.gitignore')
    expect(summary).toContain('.env')
  })

  test('includes gitignore warning when no file exists', () => {
    const summary = formatEnvSummary({
      env: { created: true, updated: [], added: ['DATABASE_URL'] },
      gitignoreStatus: 'no-file',
    })
    expect(summary).toContain('No')
    expect(summary).toContain('.gitignore')
  })
})
