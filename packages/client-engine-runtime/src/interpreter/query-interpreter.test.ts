import {
  ColumnTypeEnum,
  SqlDriverAdapter,
  SqlQuery,
  SqlQueryable,
  SqlResultSet,
  Transaction,
} from '@prisma/driver-adapter-utils'
import { expect, test } from 'vitest'

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

type TransactionSpyAdapter = SqlDriverAdapter & {
  log: string[]
  executeRawError?: (sql: string) => Error | undefined
}

function transactionSpyAdapter({ supportsTransactions }: { supportsTransactions: boolean }): TransactionSpyAdapter {
  const adapter: TransactionSpyAdapter = {
    provider: 'postgres',
    adapterName: 'test',
    log: [],
    queryRaw: () => Promise.reject(new Error('not implemented')),
    executeRaw: (query: SqlQuery) => {
      adapter.log.push(`adapter: ${query.sql}`)
      return Promise.resolve(1)
    },
    executeScript: () => Promise.reject(new Error('not implemented')),
    dispose: () => Promise.resolve(),
    startTransaction: () => {
      if (!supportsTransactions) {
        return Promise.reject(new Error('Transactions are not supported in HTTP mode'))
      }
      adapter.log.push('begin')
      const transaction: Transaction = {
        provider: 'postgres',
        adapterName: 'test',
        options: { usePhantomQuery: true },
        queryRaw: () => Promise.reject(new Error('not implemented')),
        executeRaw: (query: SqlQuery) => {
          adapter.log.push(`transaction: ${query.sql}`)
          const error = adapter.executeRawError?.(query.sql)
          return error !== undefined ? Promise.reject(error) : Promise.resolve(1)
        },
        commit: () => {
          adapter.log.push('commit')
          return Promise.resolve()
        },
        rollback: () => {
          adapter.log.push('rollback')
          return Promise.resolve()
        },
      }
      return Promise.resolve(transaction)
    },
  }
  return adapter
}

function transactionManagerFor(adapter: SqlDriverAdapter): TransactionManager {
  return new TransactionManager({
    driverAdapter: adapter,
    transactionOptions: { timeout: 5_000, maxWait: 2_000 },
    tracingHelper: noopTracingHelper,
  })
}

const updateExecuteNode: QueryPlanNode = {
  type: 'execute',
  args: {
    type: 'templateSql',
    fragments: [{ type: 'stringChunk', chunk: 'UPDATE "User" SET "name" = ' }, { type: 'parameter' }],
    placeholderFormat: { prefix: '$', hasNumbering: true } satisfies PlaceholderFormat,
    args: ['name'],
    argTypes: [{ arity: 'scalar', scalarType: 'string' }],
    chunkable: false,
  },
}

const singleStatementUpdatePlan: QueryPlanNode = {
  type: 'transaction',
  args: updateExecuteNode,
}

function chunkableDeletePlan(ids: number[]): QueryPlanNode {
  return {
    type: 'transaction',
    args: {
      type: 'execute',
      args: {
        type: 'templateSql',
        fragments: [
          { type: 'stringChunk', chunk: 'DELETE FROM "User" WHERE "id" IN ' },
          { type: 'parameterTuple', itemPrefix: '', itemSeparator: ',', itemSuffix: '' },
        ],
        placeholderFormat: { prefix: '$', hasNumbering: true } satisfies PlaceholderFormat,
        args: [ids],
        argTypes: [{ arity: 'scalar', scalarType: 'int' }],
        chunkable: true,
      },
    },
  }
}

// Regression test for https://github.com/prisma/prisma/issues/29748: single-statement plans
// (e.g. `updateMany`, `createMany`) used to eagerly start an internal transaction, which is
// pure overhead and a hard failure on driver adapters without transaction support, such as
// Neon over HTTP.
test('executes a single-statement transaction plan without starting a transaction', async () => {
  const adapter = transactionSpyAdapter({ supportsTransactions: false })
  const interpreter = QueryInterpreter.forSql({ tracingHelper: noopTracingHelper })

  const result = await interpreter.run(singleStatementUpdatePlan, {
    queryable: adapter,
    transactionManager: { enabled: true, manager: transactionManagerFor(adapter) },
    scope: {},
  })

  expect(result).toBe(1)
  expect(adapter.log).toEqual(['adapter: UPDATE "User" SET "name" = $1'])
})

test('starts a transaction when a single statement node is chunked into multiple statements', async () => {
  const adapter = transactionSpyAdapter({ supportsTransactions: true })
  const interpreter = QueryInterpreter.forSql({
    tracingHelper: noopTracingHelper,
    connectionInfo: { maxBindValues: 2, supportsRelationJoins: false },
  })

  const result = await interpreter.run(chunkableDeletePlan([1, 2, 3, 4]), {
    queryable: adapter,
    transactionManager: { enabled: true, manager: transactionManagerFor(adapter) },
    scope: {},
  })

  expect(result).toBe(2)
  expect(adapter.log).toEqual([
    'begin',
    'transaction: DELETE FROM "User" WHERE "id" IN ($1,$2)',
    'transaction: DELETE FROM "User" WHERE "id" IN ($1,$2)',
    'commit',
  ])
})

test('does not start a transaction when a chunkable statement fits in a single chunk', async () => {
  const adapter = transactionSpyAdapter({ supportsTransactions: false })
  const interpreter = QueryInterpreter.forSql({
    tracingHelper: noopTracingHelper,
    connectionInfo: { maxBindValues: 2, supportsRelationJoins: false },
  })

  const result = await interpreter.run(chunkableDeletePlan([1, 2]), {
    queryable: adapter,
    transactionManager: { enabled: true, manager: transactionManagerFor(adapter) },
    scope: {},
  })

  expect(result).toBe(1)
  expect(adapter.log).toEqual(['adapter: DELETE FROM "User" WHERE "id" IN ($1,$2)'])
})

test('rolls back the transaction when a later chunk of a deferred statement fails', async () => {
  const adapter = transactionSpyAdapter({ supportsTransactions: true })
  let statementCount = 0
  adapter.executeRawError = () => (++statementCount === 2 ? new Error('boom') : undefined)
  const interpreter = QueryInterpreter.forSql({
    tracingHelper: noopTracingHelper,
    connectionInfo: { maxBindValues: 2, supportsRelationJoins: false },
  })

  await expect(
    interpreter.run(chunkableDeletePlan([1, 2, 3, 4]), {
      queryable: adapter,
      transactionManager: { enabled: true, manager: transactionManagerFor(adapter) },
      scope: {},
    }),
  ).rejects.toThrow('boom')

  expect(adapter.log).toEqual([
    'begin',
    'transaction: DELETE FROM "User" WHERE "id" IN ($1,$2)',
    'transaction: DELETE FROM "User" WHERE "id" IN ($1,$2)',
    'rollback',
  ])
})

test('still wraps multi-statement transaction plans in a transaction', async () => {
  const adapter = transactionSpyAdapter({ supportsTransactions: true })
  const interpreter = QueryInterpreter.forSql({ tracingHelper: noopTracingHelper })

  const result = await interpreter.run(
    { type: 'transaction', args: { type: 'seq', args: [updateExecuteNode, updateExecuteNode] } },
    {
      queryable: adapter,
      transactionManager: { enabled: true, manager: transactionManagerFor(adapter) },
      scope: {},
    },
  )

  expect(result).toBe(1)
  expect(adapter.log).toEqual([
    'begin',
    'transaction: UPDATE "User" SET "name" = $1',
    'transaction: UPDATE "User" SET "name" = $1',
    'commit',
  ])
})
