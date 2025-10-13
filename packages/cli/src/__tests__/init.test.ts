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

  it('should create refract.config.ts and schema.prisma', async () => {
    const command = new InitCommand()

    const result = await command.execute({
      url: 'postgresql://test:test@localhost:5432/test',
      template: 'basic',
    })

    expect(result.success).toBe(true)
    expect(existsSync('refract.config.ts')).toBe(true)
    expect(existsSync('schema.prisma')).toBe(true)
    expect(existsSync('.env')).toBe(true)
  })

  it('should create refract.config.ts with all supported providers', async () => {
    const command = new InitCommand()
    const testCases = [
      { url: 'postgresql://user:pass@localhost:5432/db', expectedProvider: 'postgresql' },
      { url: 'mysql://user:pass@localhost:3306/db', expectedProvider: 'mysql' },
      { url: 'file:./dev.db', expectedProvider: 'sqlite' },
      { url: 'postgresql://user:pass@ep-example.us-east-1.aws.neon.tech/db', expectedProvider: 'neon' },
      { url: 'postgresql://postgres:pass@db.project.supabase.co:5432/postgres', expectedProvider: 'postgresql' },
      { url: 'd1://my-database', expectedProvider: 'd1' },
    ]

    for (const { url, expectedProvider } of testCases) {
      // Clean up between tests
      if (existsSync('refract.config.ts')) unlinkSync('refract.config.ts')
      if (existsSync('schema.prisma')) unlinkSync('schema.prisma')
      if (existsSync('.env')) unlinkSync('.env')

      const result = await command.execute({
        url,
        template: 'basic',
      })

      expect(result.success).toBe(true)
      expect(existsSync('refract.config.ts')).toBe(true)

      const configContent = readFileSync('refract.config.ts', 'utf8')
      expect(configContent).toContain(`provider: '${expectedProvider}'`)
      expect(configContent).toContain(url)
    }
  })

  it('should create schema.prisma with different templates', async () => {
    const command = new InitCommand()
    const templates = ['basic', 'ecommerce', 'blog']

    for (const template of templates) {
      // Clean up between tests
      if (existsSync('refract.config.ts')) unlinkSync('refract.config.ts')
      if (existsSync('schema.prisma')) unlinkSync('schema.prisma')
      if (existsSync('.env')) unlinkSync('.env')

      const result = await command.execute({
        url: 'postgresql://test:test@localhost:5432/test',
        template: template as any,
      })

      expect(result.success).toBe(true)
      expect(existsSync('schema.prisma')).toBe(true)

      const schemaContent = readFileSync('schema.prisma', 'utf8')
      expect(schemaContent).toContain('model User')

      if (template === 'ecommerce') {
        expect(schemaContent).toContain('model Product')
        expect(schemaContent).toContain('model Order')
        expect(schemaContent).toContain('enum OrderStatus')
      } else if (template === 'blog') {
        expect(schemaContent).toContain('model Category')
        expect(schemaContent).toContain('model Tag')
        expect(schemaContent).toContain('model Comment')
      }
    }
  })

  it('should skip files when skip options are provided', async () => {
    const command = new InitCommand()

    const result = await command.execute({
      url: 'postgresql://test:test@localhost:5432/test',
      template: 'basic',
      skipEnv: true,
      skipSchema: true,
    })

    expect(result.success).toBe(true)
    expect(existsSync('refract.config.ts')).toBe(true)
    expect(existsSync('.env')).toBe(false)
    expect(existsSync('schema.prisma')).toBe(false)
  })

  it('should skip existing files without overwriting', async () => {
    // Create existing files
    writeFileSync('.env', 'EXISTING=true')
    writeFileSync('schema.prisma', 'existing schema')

    const command = new InitCommand()
    const result = await command.execute({
      url: 'postgresql://test:test@localhost:5432/test',
      template: 'basic',
    })

    expect(result.success).toBe(true)

    const envContent = readFileSync('.env', 'utf8')
    expect(envContent).toContain('EXISTING=true')
    expect(envContent).not.toContain('DATABASE_URL')

    const schemaContent = readFileSync('schema.prisma', 'utf8')
    expect(schemaContent).toContain('existing schema')
    expect(schemaContent).not.toContain('model User')
  })

  it('should not overwrite existing config without force flag', async () => {
    const command = new InitCommand()

    // First initialization
    await command.execute({
      url: 'postgresql://test:test@localhost:5432/test',
      template: 'basic',
    })

    // Second initialization should fail
    const result = await command.execute({
      url: 'mysql://test:test@localhost:3306/test',
      template: 'basic',
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain('already exists')
  })

  it('should overwrite existing config with force flag', async () => {
    const command = new InitCommand()

    // First initialization
    await command.execute({
      url: 'postgresql://test:test@localhost:5432/test',
      template: 'basic',
    })

    // Second initialization with force should succeed
    const result = await command.execute({
      url: 'mysql://test:test@localhost:3306/test',
      template: 'basic',
      force: true,
    })

    expect(result.success).toBe(true)
  })
})

describe('Configuration Bridge', () => {
  beforeEach(() => {
    if (existsSync('refract.config.ts')) {
      unlinkSync('refract.config.ts')
    }
    if (existsSync('schema.prisma')) {
      unlinkSync('schema.prisma')
    }
  })

  afterEach(() => {
    if (existsSync('refract.config.ts')) {
      unlinkSync('refract.config.ts')
    }
    if (existsSync('schema.prisma')) {
      unlinkSync('schema.prisma')
    }
  })

  it('should detect provider from Neon URL', () => {
    const provider = detectProviderFromUrl('postgresql://user:pass@ep-example.neon.tech/dbname')
    expect(provider).toBe('neon')
  })

  it('should detect provider from Supabase URL', () => {
    const provider = detectProviderFromUrl('postgresql://user:pass@db.example.supabase.co:5432/postgres')
    expect(provider).toBe('postgresql') // Simplified approach treats Supabase as PostgreSQL
  })

  it('should detect provider from D1 URL', () => {
    const provider = detectProviderFromUrl('d1://my-database')
    expect(provider).toBe('d1')
  })

  it('should create config with auto-detection', () => {
    const config = createConfigWithAutoDetection('postgresql://user:pass@ep-example.neon.tech/dbname')

    expect(config.datasource.provider).toBe('neon')
    expect(config.datasource.url).toBe('postgresql://user:pass@ep-example.neon.tech/dbname')
    expect(config.schema).toBe('./schema.prisma')
  })
})
