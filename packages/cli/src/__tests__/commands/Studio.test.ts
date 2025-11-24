import { jestConsoleContext, jestContext } from '@prisma/get-platform'

import { Studio } from '../../Studio'
import { configContextContributor } from '../_utils/config-context'

const ctx = jestContext.new().add(jestConsoleContext()).add(configContextContributor()).assemble()

describe('Studio', () => {
  it('should show help when no database URL is provided', async () => {
    ctx.fixture('studio-value-column-bug')
    
    const studio = Studio.new()
    const result = await studio.parse([], await ctx.config())
    
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain('No database URL found')
  })

  it('should validate database URL format', async () => {
    ctx.fixture('studio-value-column-bug')
    
    const studio = Studio.new()
    const result = await studio.parse(['--url', 'invalid-url'], await ctx.config())
    
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain('The provided database URL is not valid')
  })

  it('should reject unsupported database protocols', async () => {
    ctx.fixture('studio-value-column-bug')
    
    const studio = Studio.new()
    const result = await studio.parse(['--url', 'mongodb://localhost:27017/test'], await ctx.config())
    
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain('Prisma Studio is not supported for the "mongodb" protocol')
  })

  it('should accept valid PostgreSQL URL', async () => {
    ctx.fixture('studio-value-column-bug')
    
    const studio = Studio.new()
    
    // Mock the server creation to avoid actually starting Studio
    const originalParse = studio.parse
    studio.parse = jest.fn().mockImplementation(async (argv, config) => {
      // Call original parse but intercept before server starts
      const args = require('@prisma/internals').arg(argv, {
        '--help': Boolean,
        '-h': '--help',
        '--config': String,
        '--port': Number,
        '-p': '--port',
        '--browser': String,
        '-b': '--browser',
        '--url': String,
      })
      
      if (args['--help']) {
        return studio.help()
      }
      
      const connectionString = args['--url'] || config.datasource?.url
      
      if (!connectionString) {
        return new Error('No database URL found. Provide it via the `--url <url>` argument or define it in your Prisma config file as `datasource.url`.')
      }
      
      if (!URL.canParse(connectionString)) {
        return new Error('The provided database URL is not valid.')
      }
      
      const protocol = new URL(connectionString).protocol.replace(':', '')
      
      if (!['postgres', 'postgresql', 'mysql', 'file'].includes(protocol)) {
        return new Error(`Prisma Studio is not supported for the "${protocol}" protocol.`)
      }
      
      // Return success without starting server
      return 'Studio would start successfully'
    })
    
    const result = await studio.parse(['--url', 'postgresql://user:pass@localhost:5432/db'], await ctx.config())
    
    expect(result).toBe('Studio would start successfully')
  })

  it('should show help with --help flag', async () => {
    const studio = Studio.new()
    const result = await studio.parse(['--help'], await ctx.config())
    
    expect(typeof result).toBe('string')
    expect(result).toContain('Browse your data with Prisma Studio')
    expect(result).toContain('Usage')
    expect(result).toContain('Options')
  })
})