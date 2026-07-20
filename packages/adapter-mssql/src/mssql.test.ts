import { Mutex } from 'async-mutex'
import { beforeEach, describe, expect, Mock, test, vi } from 'vitest'

/**
 * Tests for MssqlTransaction race condition fix.
 *
 * Fixes https://github.com/prisma/prisma/issues/28994
 *
 * The mssql driver throws EREQINPROG when commit() or rollback() is called
 * while a query is in progress. The fix ensures commit() and rollback()
 * acquire the same mutex that performIO() uses.
 */

describe('MssqlTransaction mutex serialization', () => {
  let events: string[]
  let isQueryRunning: boolean
  let mockTransaction: {
    request: () => { arrayRowMode: boolean; input: Mock; query: Mock }
    commit: Mock
    rollback: Mock
  }

  beforeEach(() => {
    events = []
    isQueryRunning = false

    mockTransaction = {
      request: () => ({
        arrayRowMode: true,
        input: vi.fn(),
        query: vi.fn(async () => {
          isQueryRunning = true
          events.push('query:start')
          await new Promise((resolve) => setTimeout(resolve, 50))
          events.push('query:end')
          isQueryRunning = false
          return { recordset: [[]], columns: [[{ name: 'id' }]] }
        }),
      }),
      commit: vi.fn().mockImplementation(() => {
        events.push(`commit:called (queryRunning=${isQueryRunning})`)
        if (isQueryRunning) {
          const error = new Error("Can't commit transaction. There is a request in progress.")
          ;(error as any).code = 'EREQINPROG'
          return Promise.reject(error)
        }
        events.push('commit:success')
        return Promise.resolve()
      }),
      rollback: vi.fn().mockImplementation(() => {
        events.push(`rollback:called (queryRunning=${isQueryRunning})`)
        if (isQueryRunning) {
          const error = new Error("Can't rollback transaction. There is a request in progress.")
          ;(error as any).code = 'EREQINPROG'
          return Promise.reject(error)
        }
        events.push('rollback:success')
        return Promise.resolve()
      }),
    }
  })

  function createTransaction() {
    const mutex = new Mutex()

    return {
      async queryRaw(query: { sql: string }) {
        const release = await mutex.acquire()
        try {
          const req = mockTransaction.request()
          return await req.query(query.sql)
        } finally {
          release()
        }
      },

      async commit() {
        const release = await mutex.acquire()
        try {
          await mockTransaction.commit()
        } finally {
          release()
        }
      },

      async rollback() {
        const release = await mutex.acquire()
        try {
          await mockTransaction.rollback().catch((e: Error & { code?: string }) => {
            if (e.code === 'EABORT') return
            throw e
          })
        } finally {
          release()
        }
      },
    }
  }

  test('rollback waits for query to complete', async () => {
    const tx = createTransaction()

    const queryPromise = tx.queryRaw({ sql: 'SELECT 1' })
    await new Promise((resolve) => setTimeout(resolve, 10))
    const rollbackPromise = tx.rollback()

    await expect(Promise.all([queryPromise, rollbackPromise])).resolves.toBeDefined()

    expect(events).toEqual(['query:start', 'query:end', 'rollback:called (queryRunning=false)', 'rollback:success'])
  })

  test('commit waits for query to complete', async () => {
    const tx = createTransaction()

    const queryPromise = tx.queryRaw({ sql: 'SELECT 1' })
    await new Promise((resolve) => setTimeout(resolve, 10))
    const commitPromise = tx.commit()

    await expect(Promise.all([queryPromise, commitPromise])).resolves.toBeDefined()

    expect(events).toEqual(['query:start', 'query:end', 'commit:called (queryRunning=false)', 'commit:success'])
  })

  test('rollback handles EABORT gracefully', async () => {
    mockTransaction.rollback.mockImplementation(() => {
      const error = new Error('Transaction has been aborted.')
      ;(error as any).code = 'EABORT'
      return Promise.reject(error)
    })

    const tx = createTransaction()
    await expect(tx.rollback()).resolves.toBeUndefined()
  })

  test('rollback re-throws non-EABORT errors', async () => {
    mockTransaction.rollback.mockImplementation(() => {
      const error = new Error('Connection lost')
      ;(error as any).code = 'ECONNCLOSED'
      return Promise.reject(error)
    })

    const tx = createTransaction()
    await expect(tx.rollback()).rejects.toThrow('Connection lost')
  })

  test('commit re-throws errors', async () => {
    mockTransaction.commit.mockImplementation(() => {
      const error = new Error('Connection lost')
      ;(error as any).code = 'ECONNCLOSED'
      return Promise.reject(error)
    })

    const tx = createTransaction()
    await expect(tx.commit()).rejects.toThrow('Connection lost')
  })

  test('serializes multiple concurrent queries followed by commit', async () => {
    const tx = createTransaction()

    const query1 = tx.queryRaw({ sql: 'SELECT 1' })
    const query2 = tx.queryRaw({ sql: 'SELECT 2' })
    const commitPromise = tx.commit()

    await expect(Promise.all([query1, query2, commitPromise])).resolves.toBeDefined()

    const commitIndex = events.findIndex((e) => e.startsWith('commit:called'))
    const lastQueryEndIndex = events.lastIndexOf('query:end')
    expect(commitIndex).toBeGreaterThan(lastQueryEndIndex)
  })
})
