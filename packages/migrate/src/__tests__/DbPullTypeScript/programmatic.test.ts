import { DbPullTypeScript } from '../../commands/DbPullTypeScript'
import { describeMatrix, postgresOnly } from '../__helpers__/conditionalTests'
import { createDefaultTestContext } from '../__helpers__/context'

const ctx = createDefaultTestContext()

/**
 * Tests for programmatic usage of DbPullTypeScript.
 *
 * These tests ensure the command can be used directly from TypeScript
 * code without going through the CLI interface.
 * PostgreSQL is the primary target for driver adapters and TypeScript-native execution.
 */

describeMatrix(postgresOnly, 'DbPullTypeScript programmatic usage', () => {
  describe('Direct instantiation and usage', () => {
    test('can be instantiated and used programmatically', () => {
      ctx.fixture('introspection/postgresql')

      // Create command instance
      const pullCommand = DbPullTypeScript.new()

      // Should be a proper instance
      expect(pullCommand).toBeInstanceOf(DbPullTypeScript)
      expect(typeof pullCommand.parse).toBe('function')
      expect(typeof pullCommand.help).toBe('function')
    })

    test('can introspect programmatically with --print flag', async () => {
      ctx.fixture('introspection/postgresql')

      const pullCommand = new DbPullTypeScript()
      const config = await ctx.config()

      // Execute introspection programmatically
      const result = await pullCommand.parse(['--print'], config)

      expect(result).toBe('')
      expect(ctx.normalizedCapturedStdout()).toContain('model Post')
      expect(ctx.normalizedCapturedStdout()).toContain('model User')
      expect(ctx.normalizedCapturedStdout()).toContain('model Profile')
    })

    test('can introspect programmatically without --print flag', async () => {
      ctx.fixture('introspection/postgresql')

      const pullCommand = new DbPullTypeScript()
      const config = await ctx.config()

      // Execute introspection programmatically (writes to file)
      const result = await pullCommand.parse([], config)

      expect(result).toBe('')
      expect(ctx.normalizedCapturedStdout()).toContain('Introspected 2 models')
      expect(ctx.normalizedCapturedStdout()).toContain('(TypeScript-native)')
    })

    test('can be used with custom arguments', async () => {
      ctx.fixture('introspection/postgresql')

      const pullCommand = new DbPullTypeScript()
      const config = await ctx.config()

      // Test with force flag
      const result = await pullCommand.parse(['--print', '--force'], config)

      expect(result).toBe('')
      expect(ctx.normalizedCapturedStdout()).toContain('model Post')
    })

    test('can handle errors programmatically', async () => {
      ctx.fixture('schema-only-postgresql')

      const pullCommand = new DbPullTypeScript()
      const config = await ctx.config()

      // Should throw with missing database
      await expect(pullCommand.parse([], config)).rejects.toThrow('P1003')
    })

    test('can access help programmatically', () => {
      const pullCommand = new DbPullTypeScript()

      const help = pullCommand.help()

      expect(typeof help).toBe('string')
      expect(help).toContain('Pull the state from the database')
      expect(help).toContain('TypeScript implementation')
      expect(help).toContain('prisma db pull-ts')
    })

    test('can handle help with error', () => {
      const pullCommand = new DbPullTypeScript()

      const helpWithError = pullCommand.help('Test error message')

      expect(helpWithError).toHaveProperty('message')
      expect(helpWithError.message).toContain('Test error message')
    })
  })

  describe('Configuration and environment', () => {
    test('respects configuration options', async () => {
      ctx.fixture('introspection/postgresql')

      const pullCommand = new DbPullTypeScript()
      const config = await ctx.config()

      // Should work with valid config
      const result = await pullCommand.parse(['--print'], config)
      expect(result).toBe('')
    })

    test('validates adapter requirements', async () => {
      ctx.fixture('introspection/postgresql')

      const pullCommand = new DbPullTypeScript()
      const configWithoutAdapters = await ctx.config()
      configWithoutAdapters.migrate = undefined

      // Should fail without adapters
      await expect(pullCommand.parse(['--print'], configWithoutAdapters)).rejects.toThrow(
        'TypeScript-native db pull requires driver adapters',
      )
    })
  })

  describe('Integration with existing patterns', () => {
    test('follows same interface as DbPull command', () => {
      // Both commands should have the same public interface
      const pullCommand = new DbPullTypeScript()

      expect(typeof pullCommand.parse).toBe('function')
      expect(typeof pullCommand.help).toBe('function')
      expect(typeof DbPullTypeScript.new).toBe('function')

      // Static method should return instance
      const staticInstance = DbPullTypeScript.new()
      expect(staticInstance).toBeInstanceOf(DbPullTypeScript)
    })

    test('can be used in test environments', async () => {
      ctx.fixture('introspection/postgresql')

      // This demonstrates how the command would be used in test suites
      const testConfig = await ctx.config()
      const pullCommand = new DbPullTypeScript()

      const result = await pullCommand.parse(['--print'], testConfig)

      expect(result).toBe('')
      expect(ctx.normalizedCapturedStdout()).toContain('datasource db')
    })
  })

  describe('TypeScript API patterns', () => {
    test('supports async/await patterns', async () => {
      ctx.fixture('introspection/postgresql')

      const pullCommand = new DbPullTypeScript()
      const config = await ctx.config()

      // Should work with async/await
      const result = await pullCommand.parse(['--print'], config)
      expect(result).toBe('')
    })

    test('supports Promise patterns', async () => {
      ctx.fixture('introspection/postgresql')

      const pullCommand = new DbPullTypeScript()
      const config = await ctx.config()

      // Should work with Promise chains
      return pullCommand.parse(['--print'], config).then((result) => {
        expect(result).toBe('')
        expect(ctx.normalizedCapturedStdout()).toContain('model Post')
      })
    })

    test('properly handles promise rejection', async () => {
      ctx.fixture('schema-only-postgresql')

      const pullCommand = new DbPullTypeScript()
      const config = await ctx.config()

      // Should properly reject promise on error
      return expect(pullCommand.parse([], config)).rejects.toThrow()
    })
  })

  describe('Command argument parsing', () => {
    test('parses various argument combinations', async () => {
      ctx.fixture('introspection/postgresql')

      const pullCommand = new DbPullTypeScript()
      const config = await ctx.config()

      // Test different argument combinations
      await expect(pullCommand.parse(['--print'], config)).resolves.toBe('')
      await expect(pullCommand.parse(['--print', '--force'], config)).resolves.toBe('')
      await expect(pullCommand.parse(['--help'], config)).resolves.toContain('Pull the state')
    })

    test('handles invalid arguments gracefully', async () => {
      const pullCommand = new DbPullTypeScript()
      const config = await ctx.config()

      // Should handle invalid arguments by returning help text
      const result = await pullCommand.parse(['--invalid-flag'], config)
      expect(typeof result).toBe('string')
      expect(result).toContain('Unknown or unexpected option')
    })
  })
})

