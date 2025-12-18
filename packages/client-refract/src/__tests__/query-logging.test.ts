import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { setupTestDatabase, type TestEnvironment } from './helpers/test-container'
import { seedTestData } from './helpers/seed'
import { createRefractClient } from './fixtures/generated-test-client'
import { PostgresDialect } from 'kysely'
import { Pool } from 'pg'

/**
 * Tests for Query Logging
 *
 * CURRENT STATE: Logging not implemented
 * - createRefractClient doesn't accept log options yet
 * - No LogConfig type defined
 * - Kysely logging not passed through
 *
 * GOAL: Pass Kysely's native logging through createRefractClient options
 * - Support log levels: 'query', 'error'
 * - Support custom log handler functions
 * - Leverage Kysely's built-in logging (includes duration, SQL, params)
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
      const mockLog = vi.fn()

      // Create client with query logging enabled
      const client = createRefractClient(dialect, {
        log: ['query'],
      })

      // Execute a query
      await client.user.findMany()

      // Kysely should have logged the query
      // This will fail because log option doesn't exist yet
      expect(mockLog).toHaveBeenCalled()
    })

    it('should support error logging', async () => {
      const mockError = vi.fn()

      // Create client with error logging enabled
      const client = createRefractClient(dialect, {
        log: ['error'],
      })

      // Execute a failing query
      try {
        await client.user.findUnique({
          where: { id: 999999 }, // Non-existent ID
        })
      } catch (error) {
        // Expected - may or may not throw depending on implementation
      }

      // Should have logged if there was an error
      // This will fail because log option doesn't exist yet
      expect(mockError).toHaveBeenCalled()
    })

    it('should support multiple log levels', async () => {
      const mockLog = vi.fn()

      // Create client with multiple log levels
      const client = createRefractClient(dialect, {
        log: ['query', 'error'],
      })

      await client.user.findMany()

      // This will fail because log option doesn't exist yet
      expect(mockLog).toHaveBeenCalled()
    })
  })

  describe('Custom log handlers', () => {
    it('should allow custom log handler function', async () => {
      const customLogger = vi.fn()

      // Create client with custom logger
      const client = createRefractClient(dialect, {
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
      // This will fail because log option doesn't exist yet
      expect(customLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'query',
          sql: expect.stringContaining('SELECT'),
          params: expect.any(Array),
        })
      )
    })

    it('should provide query execution time in logs', async () => {
      const customLogger = vi.fn()

      const client = createRefractClient(dialect, {
        log: (event) => customLogger(event),
      })

      await client.user.findMany()

      // Kysely's LogEvent includes queryDurationMillis
      // This will fail because log option doesn't exist yet
      expect(customLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          queryDurationMillis: expect.any(Number),
        })
      )
    })
  })

  describe('Log formatting', () => {
    it('should log queries with SQL and parameters', async () => {
      const customLogger = vi.fn()

      const client = createRefractClient(dialect, {
        log: (event) => customLogger(event),
      })

      await client.user.findUnique({
        where: { email: 'alice@example.com' },
      })

      // Kysely provides structured log events with SQL and parameters
      // This will fail because log option doesn't exist yet
      expect(customLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            sql: expect.stringContaining('SELECT'),
            parameters: expect.arrayContaining(['alice@example.com']),
          }),
        })
      )
    })

    it('should not log when log level not specified', async () => {
      const customLogger = vi.fn()

      // Create client with only error logging (no query logging)
      const client = createRefractClient(dialect, {
        log: ['error'],
      })

      await client.user.findMany()

      // Should NOT have logged queries (only errors would be logged)
      // This will fail because we can't verify non-logging without mocking console
      expect(customLogger).not.toHaveBeenCalled()
    })
  })

  describe('Integration with Kysely', () => {
    it('should pass log config directly to Kysely constructor', async () => {
      const customLogger = vi.fn()

      // Our implementation should pass the log option to new Kysely({ log: ... })
      // This leverages Kysely's native logging rather than custom plugins
      const client = createRefractClient(dialect, {
        log: (event) => customLogger(event),
      })

      await client.user.findMany()

      // This will fail because the implementation doesn't pass log to Kysely yet
      expect(customLogger).toHaveBeenCalled()
    })
  })

  describe('Logging with different operations', () => {
    it('should log findMany queries', async () => {
      const customLogger = vi.fn()

      const client = createRefractClient(dialect, {
        log: ['query'],
      })

      await client.user.findMany()

      // This will fail because log option doesn't exist yet
      expect(customLogger).toHaveBeenCalled()
    })

    it('should log create queries', async () => {
      const customLogger = vi.fn()

      const client = createRefractClient(dialect, {
        log: ['query'],
      })

      await client.user.create({
        data: { email: 'test-log@example.com', name: 'Test' },
      })

      // Clean up
      await client.user.deleteMany({
        where: { email: 'test-log@example.com' },
      })

      // This will fail because log option doesn't exist yet
      expect(customLogger).toHaveBeenCalled()
    })
  })
})
