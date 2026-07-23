import {
  ColumnTypeEnum,
  SqlDriverAdapter,
  SqlQuery,
  SqlQueryable,
  SqlResultSet,
  Transaction,
} from '@prisma/driver-adapter-utils'
import { expect, test, vi } from 'vitest'

import type { PlaceholderFormat, QueryPlanNode } from '../query-plan'
import { noopTracingHelper } from '../tracing'
import { TransactionManager } from '../transaction-manager/transaction-manager'
import { QueryInterpreter } from './query-interpreter'

function resultSetWithRows(rowCount: number): SqlResultSet {
  return {
    columnNames: ['id'],
    columnTypes: [ColumnTypeEnum.Int32],
    rows: Array.from({ length: rowCount }, (_, i) => [i]),
  }
}

// Regression test for https://github.com/prisma/prisma/issues/29746: merging the rows of a chunked
// query used to spread the whole result set onto the stack (`results.rows.push(...result.rows)`),
// overflowing the call stack when a single chunk returned hundreds of thousands of rows.
test('merges chunked query results without overflowing the stack', async () => {
  const rowsPerLaterChunk = 200_000

  let call = 0
  const queryable: SqlQueryable = {
    provider: 'postgres',
    adapterName: 'test',
    queryRaw: (_query: SqlQuery) => {
      call++
      // The first chunk yields no rows so the whole result set is delivered by the second chunk
      // through the spread-based merge path that used to overflow the stack.
      return Promise.resolve(resultSetWithRows(call === 1 ? 0 : rowsPerLaterChunk))
    },
    executeRaw: () => Promise.resolve(0),
  }

  const interpreter = QueryInterpreter.forSql({
    tracingHelper: noopTracingHelper,
    connectionInfo: { maxBindValues: 2, supportsRelationJoins: false },
  })

  const queryPlan: QueryPlanNode = {
    type: 'query',
    args: {
      type: 'templateSql',
      fragments: [
        { type: 'stringChunk', chunk: 'SELECT * FROM users WHERE "id" IN ' },
        { type: 'parameterTuple', itemPrefix: '', itemSeparator: ',', itemSuffix: '' },
      ],
      placeholderFormat: {
        prefix: '$',
        hasNumbering: true,
      } satisfies PlaceholderFormat,
      args: [[1, 2, 3, 4]],
      argTypes: [{ arity: 'scalar', scalarType: 'int' }],
      chunkable: true,
    },
  }

  const result = await interpreter.run(queryPlan, {
    queryable,
    transactionManager: { enabled: false },
    scope: {},
  })

  expect(call).toBe(2)
  expect(result).toHaveLength(rowsPerLaterChunk)
})

class MockTransactionAdapter implements SqlDriverAdapter {
  adapterName = 'mock-adapter'
  provider = 'postgres' as const

  startTransactionMock = vi.fn()
  commitMock = vi.fn().mockResolvedValue(undefined)
  rollbackMock = vi.fn().mockResolvedValue(undefined)
  txExecuteRawMock = vi.fn().mockResolvedValue(1)
  txQueryRawMock = vi.fn().mockImplementation(() => Promise.resolve(resultSetWithRows(1)))
  executeRawMock = vi.fn().mockResolvedValue(1)
  queryRawMock = vi.fn().mockImplementation(() => Promise.resolve(resultSetWithRows(1)))

  executeRaw(query: SqlQuery): Promise<number> {
    return this.executeRawMock(query)
  }

  queryRaw(query: SqlQuery): Promise<SqlResultSet> {
    return this.queryRawMock(query)
  }

  executeScript(): Promise<void> {
    throw new Error('Not implemented for test')
  }

  dispose(): Promise<void> {
    return Promise.resolve()
  }

  startTransaction(): Promise<Transaction> {
    this.startTransactionMock()
    return Promise.resolve({
      adapterName: this.adapterName,
      provider: this.provider,
      options: { usePhantomQuery: true },
      executeRaw: this.txExecuteRawMock,
      queryRaw: this.txQueryRawMock,
      commit: this.commitMock,
      rollback: this.rollbackMock,
      createSavepoint: () => Promise.resolve(),
      rollbackToSavepoint: () => Promise.resolve(),
      releaseSavepoint: () => Promise.resolve(),
    })
  }
}

function makeTransactionManager(driverAdapter: SqlDriverAdapter): TransactionManager {
  return new TransactionManager({
    driverAdapter,
    transactionOptions: {},
    tracingHelper: noopTracingHelper,
  })
}

// The plans below get split into two chunks: `maxBindValues` is 2 and four values are bound.
const chunkedInterpreter = QueryInterpreter.forSql({
  tracingHelper: noopTracingHelper,
  connectionInfo: { maxBindValues: 2, supportsRelationJoins: false },
})

function statementNode(type: 'query' | 'execute', args: number[]): QueryPlanNode {
  return {
    type,
    args: {
      type: 'templateSql',
      fragments: [
        { type: 'stringChunk', chunk: 'DELETE FROM users WHERE "id" IN ' },
        { type: 'parameterTuple', itemPrefix: '', itemSeparator: ',', itemSuffix: '' },
      ],
      placeholderFormat: {
        prefix: '$',
        hasNumbering: true,
      } satisfies PlaceholderFormat,
      args: [args],
      argTypes: [{ arity: 'scalar', scalarType: 'int' }],
      chunkable: true,
    },
  }
}

// A statement that gets split into multiple chunks is no longer atomic on its own, so the
// interpreter must wrap the chunks in a transaction to avoid committing a partial write when
// a later chunk fails (see https://github.com/prisma/prisma-engines/pull/5840).
test('wraps a chunked execute in a transaction', async () => {
  const adapter = new MockTransactionAdapter()

  const result = await chunkedInterpreter.run(statementNode('execute', [1, 2, 3, 4]), {
    queryable: adapter,
    transactionManager: { enabled: true, manager: makeTransactionManager(adapter) },
    scope: {},
  })

  expect(result).toBe(2)
  expect(adapter.startTransactionMock).toHaveBeenCalledTimes(1)
  expect(adapter.txExecuteRawMock).toHaveBeenCalledTimes(2)
  expect(adapter.executeRawMock).not.toHaveBeenCalled()
  expect(adapter.commitMock).toHaveBeenCalledTimes(1)
  expect(adapter.rollbackMock).not.toHaveBeenCalled()
})

test('wraps a chunked query in a transaction', async () => {
  const adapter = new MockTransactionAdapter()

  const result = await chunkedInterpreter.run(statementNode('query', [1, 2, 3, 4]), {
    queryable: adapter,
    transactionManager: { enabled: true, manager: makeTransactionManager(adapter) },
    scope: {},
  })

  expect(result).toHaveLength(2)
  expect(adapter.startTransactionMock).toHaveBeenCalledTimes(1)
  expect(adapter.txQueryRawMock).toHaveBeenCalledTimes(2)
  expect(adapter.queryRawMock).not.toHaveBeenCalled()
  expect(adapter.commitMock).toHaveBeenCalledTimes(1)
})

test('rolls back the chunk transaction when a later chunk fails', async () => {
  const adapter = new MockTransactionAdapter()
  adapter.txExecuteRawMock.mockResolvedValueOnce(1).mockRejectedValueOnce(new Error('chunk failed'))

  await expect(
    chunkedInterpreter.run(statementNode('execute', [1, 2, 3, 4]), {
      queryable: adapter,
      transactionManager: { enabled: true, manager: makeTransactionManager(adapter) },
      scope: {},
    }),
  ).rejects.toThrow('chunk failed')

  expect(adapter.txExecuteRawMock).toHaveBeenCalledTimes(2)
  expect(adapter.commitMock).not.toHaveBeenCalled()
  expect(adapter.rollbackMock).toHaveBeenCalledTimes(1)
})

test('does not start a transaction for a single-chunk statement', async () => {
  const adapter = new MockTransactionAdapter()

  const result = await chunkedInterpreter.run(statementNode('execute', [1, 2]), {
    queryable: adapter,
    transactionManager: { enabled: true, manager: makeTransactionManager(adapter) },
    scope: {},
  })

  expect(result).toBe(1)
  expect(adapter.startTransactionMock).not.toHaveBeenCalled()
  expect(adapter.executeRawMock).toHaveBeenCalledTimes(1)
})

test('does not start a nested transaction for chunked statements inside a transaction node', async () => {
  const adapter = new MockTransactionAdapter()

  const plan: QueryPlanNode = { type: 'transaction', args: statementNode('execute', [1, 2, 3, 4]) }
  const result = await chunkedInterpreter.run(plan, {
    queryable: adapter,
    transactionManager: { enabled: true, manager: makeTransactionManager(adapter) },
    scope: {},
  })

  expect(result).toBe(2)
  expect(adapter.startTransactionMock).toHaveBeenCalledTimes(1)
  expect(adapter.txExecuteRawMock).toHaveBeenCalledTimes(2)
  expect(adapter.commitMock).toHaveBeenCalledTimes(1)
})

test('rethrows the original chunk error when the rollback fails as well', async () => {
  const adapter = new MockTransactionAdapter()
  adapter.txExecuteRawMock.mockResolvedValueOnce(1).mockRejectedValueOnce(new Error('chunk failed'))
  adapter.rollbackMock.mockRejectedValue(new Error('rollback failed'))

  await expect(
    chunkedInterpreter.run(statementNode('execute', [1, 2, 3, 4]), {
      queryable: adapter,
      transactionManager: { enabled: true, manager: makeTransactionManager(adapter) },
      scope: {},
    }),
  ).rejects.toThrow('chunk failed')

  expect(adapter.rollbackMock).toHaveBeenCalledTimes(1)
})

// Executors pass `transactionManager: { enabled: false }` exactly when the plan runs inside an
// interactive transaction, with that transaction as the queryable, so the chunks are already
// covered by it.
test('runs chunked statements directly when already inside an interactive transaction', async () => {
  const adapter = new MockTransactionAdapter()

  const result = await chunkedInterpreter.run(statementNode('execute', [1, 2, 3, 4]), {
    queryable: adapter,
    transactionManager: { enabled: false },
    scope: {},
  })

  expect(result).toBe(2)
  expect(adapter.startTransactionMock).not.toHaveBeenCalled()
  expect(adapter.executeRawMock).toHaveBeenCalledTimes(2)
})
