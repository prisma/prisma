import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { InitCommand } from '../commands/init.js'
import { createConfigWithAutoDetection, detectProviderFromUrl } from '../utils/config.js'

// Mock prompts to avoid interactive input during tests
vi.mock('prompts', () => ({
  default: vi.fn().mockResolvedValue({ continue: true }),
}))

// Mock logger to capture output
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('InitCommand', () => {
  const testDir = resolve(__dirname, '../../test-temp')
  const originalCwd = process.cwd()

  beforeEach(() => {
    // Create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true })
    }
    mkdirSync(testDir, { recursive: true })
    process.chdir(testDir)
  })

  afterEach(() => {
    // Cleanup
    process.chdir(originalCwd)
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true })
    }
  })

  it('should create ork.config.ts and schema.prisma', async () => {
    const command = new InitCommand()

    const result = await command.execute({
      url: 'postgresql://test:test@localhost:5432/test',
    })

    expect(result.success).toBe(true)
    expect(existsSync('ork.config.ts')).toBe(true)
    expect(existsSync('schema.prisma')).toBe(true)
  })

  it('should omit datasource.url in schema.prisma even when a URL is provided', async () => {
    const command = new InitCommand()
    const url = 'postgresql://test:test@localhost:5432/test'

    const result = await command.execute({
      url,
    })

    expect(result.success).toBe(true)

    const schemaContent = readFileSync('schema.prisma', 'utf8')
    expect(schemaContent).toContain('provider = "postgresql"')
    expect(schemaContent).not.toContain('url')
    expect(schemaContent).not.toContain('env("DATABASE_URL")')
  })

  it('should create ork.config.ts with all supported providers', async () => {
    const command = new InitCommand()
    const testCases = [
      { url: 'postgresql://user:pass@localhost:5432/db', expectedProvider: 'postgresql' },
      { url: 'mysql://user:pass@localhost:3306/db', expectedProvider: 'mysql' },
      { url: 'file:./dev.db', expectedProvider: 'sqlite' },
      { url: 'd1://my-database', expectedProvider: 'd1' },
    ]

    for (const { url, expectedProvider } of testCases) {
      // Clean up between tests
      if (existsSync('ork.config.ts')) unlinkSync('ork.config.ts')
      if (existsSync('schema.prisma')) unlinkSync('schema.prisma')

      const result = await command.execute({
        url,
      })

      expect(result.success).toBe(true)
      expect(existsSync('ork.config.ts')).toBe(true)

      const configContent = readFileSync('ork.config.ts', 'utf8')
      expect(configContent).toContain(`provider: '${expectedProvider}'`)
      expect(configContent).toContain(url)
    }
  })

  it('should skip files when skip options are provided', async () => {
    const command = new InitCommand()

    const result = await command.execute({
      url: 'postgresql://test:test@localhost:5432/test',
      skipSchema: true,
    })

    expect(result.success).toBe(true)
    expect(existsSync('ork.config.ts')).toBe(true)
    expect(existsSync('schema.prisma')).toBe(false)
  })

  it('should create config with provider when no URL is provided', async () => {
    const command = new InitCommand()

    const result = await command.execute({
      provider: 'sqlite',
      skipSchema: true,
    })

    expect(result.success).toBe(true)
    expect(existsSync('ork.config.ts')).toBe(true)

    const configContent = readFileSync('ork.config.ts', 'utf8')
    expect(configContent).toContain("provider: 'sqlite'")
    expect(configContent).toContain("url: ''")
  })

  it('should skip existing files without overwriting', async () => {
    // Create existing files
    writeFileSync('schema.prisma', 'existing schema')

    const command = new InitCommand()
    const result = await command.execute({
      url: 'postgresql://test:test@localhost:5432/test',
    })

    expect(result.success).toBe(true)

    const schemaContent = readFileSync('schema.prisma', 'utf8')
    expect(schemaContent).toContain('existing schema')
    expect(schemaContent).not.toContain('model User')
  })

  it('should not overwrite existing config without force flag', async () => {
    const command = new InitCommand()

    // First initialization
    await command.execute({
      url: 'postgresql://test:test@localhost:5432/test',
    })

    // Second initialization should fail
    const result = await command.execute({
      url: 'mysql://test:test@localhost:3306/test',
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain('already exists')
  })

  it('should overwrite existing config with force flag', async () => {
    const command = new InitCommand()

    // First initialization
    await command.execute({
      url: 'postgresql://test:test@localhost:5432/test',
    })

    // Second initialization with force should succeed
    const result = await command.execute({
      url: 'mysql://test:test@localhost:3306/test',
      force: true,
    })

    expect(result.success).toBe(true)
  })
})

describe('Configuration Bridge', () => {
  beforeEach(() => {
    if (existsSync('ork.config.ts')) {
      unlinkSync('ork.config.ts')
    }
    if (existsSync('schema.prisma')) {
      unlinkSync('schema.prisma')
    }
  })

  afterEach(() => {
    if (existsSync('ork.config.ts')) {
      unlinkSync('ork.config.ts')
    }
    if (existsSync('schema.prisma')) {
      unlinkSync('schema.prisma')
    }
  })

  it('should detect provider from D1 URL', () => {
    const provider = detectProviderFromUrl('d1://my-database')
    expect(provider).toBe('d1')
  })

  it('should create config with auto-detection', () => {
    const config = createConfigWithAutoDetection('postgresql://user:pass@localhost:5432/dbname')

    expect(config.datasource.provider).toBe('postgresql')
    expect(config.datasource.url).toBe('postgresql://user:pass@localhost:5432/dbname')
    expect(config.schema).toBe('./schema.prisma')
  })
})
