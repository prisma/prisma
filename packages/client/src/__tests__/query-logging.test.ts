import { PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { createOrkClient } from './fixtures/generated-test-client'
import { seedTestData } from './helpers/seed'
import { setupTestDatabase, type TestEnvironment } from './helpers/test-container'

/**
 * Tests for Query Logging
 *
 * Implementation passes Kysely's native logging through createOrkClient options:
 * - Support log levels: 'query', 'error'
 * - Support custom log handler functions
 * - Leverages Kysely's built-in logging (includes duration, SQL, params)
 */
describe('Query Logging', () => {
  let testEnv: TestEnvironment
  let pool: Pool
  let dialect: PostgresDialect

  beforeAll(async () => {
    testEnv = await setupTestDatabase()
    await seedTestData(testEnv.kysely)

    // Extract pool and dialect for creating clients with logging
    pool = new Pool({
      host: testEnv.container.getHost(),
      port: testEnv.container.getPort(),
      database: testEnv.container.getDatabase(),
      user: testEnv.container.getUsername(),
      password: testEnv.container.getPassword(),
    })
    dialect = new PostgresDialect({ pool })
  })

  afterAll(async () => {
    await pool.end()
    await testEnv.cleanup()
  })

  describe('Log levels', () => {
    it('should support query logging', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // Create client with query logging enabled
      const client = createOrkClient(dialect, {
        log: ['query'],
      })

      // Execute a query
      await client.user.findMany()

      // Kysely should have logged the query via console
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should support error logging', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Create client with error logging enabled
      const client = createOrkClient(dialect, {
        log: ['error'],
      })

      // Execute a failing query to trigger error logging
      try {
        await client.$kysely.selectFrom('MissingTable').selectAll().execute()
      } catch {
        // Expected error from missing table
      }

      expect(errorSpy).toHaveBeenCalled()
      errorSpy.mockRestore()
    })

    it('should support multiple log levels', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Create client with multiple log levels
      const client = createOrkClient(dialect, {
        log: ['query', 'error'],
      })

      await client.user.findMany()
      try {
        await client.$kysely.selectFrom('MissingTable').selectAll().execute()
      } catch {
        // Expected error from missing table
      }

      expect(consoleSpy).toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
      errorSpy.mockRestore()
    })
  })

  describe('Custom log handlers', () => {
    it('should allow custom log handler function', async () => {
      const customLogger = vi.fn()

      // Create client with custom logger
      const client = createOrkClient(dialect, {
        log: (event) => {
          customLogger({
            level: event.level,
            sql: event.query.sql,
            params: event.query.parameters,
          })
        },
      })

      await client.user.findMany()

      // Should have called custom logger with query details
      expect(customLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'query',
          sql: expect.stringMatching(/select/i),
          params: expect.any(Array),
        }),
      )
    })

    it('should provide query execution time in logs', async () => {
      const customLogger = vi.fn()

      const client = createOrkClient(dialect, {
        log: (event) => customLogger(event),
      })

      await client.user.findMany()

      // Kysely's LogEvent includes queryDurationMillis
      expect(customLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          queryDurationMillis: expect.any(Number),
        }),
      )
    })
  })

  describe('Log formatting', () => {
    it('should log queries with SQL and parameters', async () => {
      const customLogger = vi.fn()

      const client = createOrkClient(dialect, {
        log: (event) => customLogger(event),
      })

      await client.user.findUnique({
        where: { email: 'alice@example.com' },
      })

      // Kysely provides structured log events with SQL and parameters
      expect(customLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            sql: expect.stringMatching(/select/i),
            parameters: expect.arrayContaining(['alice@example.com']),
          }),
        }),
      )
    })

    it('should not log when log level not specified', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // Create client with only error logging (no query logging)
      const client = createOrkClient(dialect, {
        log: ['error'],
      })

      await client.user.findMany()

      // Should NOT have logged queries (only errors would be logged)
      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('Integration with Kysely', () => {
    it('should pass log config directly to Kysely constructor', async () => {
      const customLogger = vi.fn()

      // Our implementation passes the log option to new Kysely({ log: ... })
      // This leverages Kysely's native logging rather than custom plugins
      const client = createOrkClient(dialect, {
        log: (event) => customLogger(event),
      })

      await client.user.findMany()

      expect(customLogger).toHaveBeenCalled()
    })
  })

  describe('Logging with different operations', () => {
    it('should log findMany queries', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const client = createOrkClient(dialect, {
        log: ['query'],
      })

      await client.user.findMany()

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should log create queries', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const client = createOrkClient(dialect, {
        log: ['query'],
      })

      await client.user.create({
        data: { email: 'test-log@example.com', name: 'Test' },
      })

      // Clean up
      await client.user.deleteMany({
        where: { email: 'test-log@example.com' },
      })

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})
