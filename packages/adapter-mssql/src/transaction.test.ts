import sql from 'mssql'
import { describe, expect, it, vi } from 'vitest'

import { PrismaMssqlAdapter } from './mssql'

// Mock mssql
vi.mock('mssql', () => {
  return {
    default: {
      ConnectionPool: class {
        on() {}
        connect() {
          return Promise.resolve()
        }
        close() {
          return Promise.resolve()
        }
        transaction() {
          return {}
        } // Overridden in test
        request() {
          return {}
        }
      },
    },
  }
})

describe('PrismaMssqlAdapter transaction regression', () => {
  it('should reproduce EREQINPROG when rollback is called during active query', async () => {
    // Setup mock behavior
    let requestActive = false
    let queryStartedResolve: () => void
    const queryStarted = new Promise<void>((resolve) => (queryStartedResolve = resolve))

    const rollbackMock = vi.fn().mockImplementation(async () => {
      await Promise.resolve()
      if (requestActive) {
        const err = new Error("Can't rollback transaction. There is a request in progress.") as Error & {
          code: string
        }
        err.code = 'EREQINPROG'
        throw err
      }
    })

    const queryMock = vi.fn().mockImplementation(async () => {
      requestActive = true
      queryStartedResolve()
      await new Promise((resolve) => setTimeout(resolve, 100))
      requestActive = false
      return { recordset: [], rowsAffected: [], columns: [] }
    })

    // Apply mocks
    const pool = new sql.ConnectionPool({
      server: 'localhost',
      user: 'sa',
      password: 'Password123',
      database: 'test',
    })
    pool.transaction = () =>
      ({
        on: () => {},
        begin: async () => {},
        commit: async () => {},
        rollback: rollbackMock,
        request: () => ({
          input: () => {},
          query: queryMock,
          arrayRowMode: false,
        }),
      }) as any

    const adapter = new PrismaMssqlAdapter(pool)
    const tx = await adapter.startTransaction()

    // Start a slow query
    const queryPromise = tx.queryRaw({ sql: 'SELECT 1', args: [], argTypes: [] })

    await queryStarted

    // Call rollback immediately
    // With the fix, this will wait for the query to finish and then succeed
    const rollbackPromise = tx.rollback()

    await expect(rollbackPromise).resolves.toBeUndefined()

    await queryPromise
  })
})
