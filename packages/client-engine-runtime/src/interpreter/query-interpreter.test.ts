import { ColumnTypeEnum, SqlQuery, SqlQueryable, SqlResultSet } from '@prisma/driver-adapter-utils'
import { describe, expect, test, vi } from 'vitest'

import type { PlaceholderFormat, QueryPlanNode } from '../query-plan'
import { noopTracingHelper } from '../tracing'
import { purifyQueryPlan, QueryInterpreter, type QueryRuntimeOptions } from './query-interpreter'

function resultSetWithRows(rowCount: number): SqlResultSet {
  return {
    columnNames: ['id'],
    columnTypes: [ColumnTypeEnum.Int32],
    rows: Array.from({ length: rowCount }, (_, i) => [i]),
  }
}

function queryNode(sql: string): QueryPlanNode {
  return {
    type: 'query',
    args: {
      type: 'templateSql',
      fragments: [{ type: 'stringChunk', chunk: sql }],
      placeholderFormat: { prefix: '$', hasNumbering: true },
      args: [],
      argTypes: [],
      chunkable: false,
    },
  }
}

function userResultSet(id: number, name: string): SqlResultSet {
  return {
    columnNames: ['id', 'name'],
    columnTypes: [ColumnTypeEnum.Int32, ColumnTypeEnum.Text],
    rows: [[id, name]],
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

test('run() leaves a shared query plan intact between runs', async () => {
  const plan: QueryPlanNode = {
    type: 'unique',
    args: queryNode('SELECT "id", "name" FROM "User" WHERE "id" = 1'),
  }
  const original = structuredClone(plan)

  const queryable = {
    provider: 'postgres' as const,
    adapterName: 'mock',
    queryRaw: vi.fn().mockResolvedValueOnce(userResultSet(1, 'Alice')).mockResolvedValueOnce(userResultSet(2, 'Bob')),
    executeRaw: vi.fn(),
  }

  const interpreter = QueryInterpreter.forSql({ tracingHelper: noopTracingHelper })
  const options: QueryRuntimeOptions = { queryable, transactionManager: { enabled: false }, scope: {} }

  await expect(interpreter.run(plan, options)).resolves.toEqual({ id: 1, name: 'Alice' })
  await expect(interpreter.run(plan, options)).resolves.toEqual({ id: 2, name: 'Bob' })

  expect(queryable.queryRaw).toHaveBeenCalledTimes(2)
  expect(plan).toEqual(original)
})

describe('purifyQueryPlan', () => {
  test('substitutes the single impure node without mutating the input plan', async () => {
    const query = queryNode('SELECT "id" FROM "User" LIMIT 1')
    const plan: QueryPlanNode = { type: 'unique', args: query }
    const original = structuredClone(plan)

    const evalNode = vi.fn().mockResolvedValue({ value: [{ id: 1 }], lastInsertId: '1' })
    const purified = await purifyQueryPlan(plan, evalNode)

    expect(evalNode).toHaveBeenCalledTimes(1)
    expect(evalNode).toHaveBeenCalledWith(query)
    expect(purified).toEqual({
      type: 'unique',
      args: { type: 'value', args: [{ id: 1 }], lastInsertId: '1' },
    })
    expect(plan).toEqual(original)
  })

  test('shares unaffected subtrees with the input plan', async () => {
    const sibling: QueryPlanNode = { type: 'value', args: 1 }
    const plan: QueryPlanNode = {
      type: 'seq',
      args: [sibling, { type: 'unique', args: queryNode('SELECT 1') }],
    }

    const purified = await purifyQueryPlan(plan, vi.fn().mockResolvedValue({ value: 2 }))

    expect(purified?.type).toBe('seq')
    if (purified?.type === 'seq') {
      expect(purified.args[0]).toBe(sibling)
    }
  })

  test('returns undefined when the plan contains a transaction node', () => {
    const plan: QueryPlanNode = {
      type: 'seq',
      args: [{ type: 'transaction', args: queryNode('INSERT INTO "User" DEFAULT VALUES') }, queryNode('SELECT 1')],
    }

    const evalNode = vi.fn()
    expect(purifyQueryPlan(plan, evalNode)).toBeUndefined()
    expect(evalNode).not.toHaveBeenCalled()
  })

  test('returns undefined when the plan contains multiple impure nodes', () => {
    const plan: QueryPlanNode = {
      type: 'seq',
      args: [queryNode('SELECT 1'), queryNode('SELECT 2')],
    }

    expect(purifyQueryPlan(plan, vi.fn())).toBeUndefined()
  })

  test('returns undefined for fully pure plans', () => {
    const plan: QueryPlanNode = { type: 'value', args: 42 }

    expect(purifyQueryPlan(plan, vi.fn())).toBeUndefined()
  })
})
