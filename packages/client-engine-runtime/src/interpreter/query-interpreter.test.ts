import type { SqlQuery, SqlQueryable, SqlResultSet } from '@prisma/driver-adapter-utils'
import { expect, test } from 'vitest'

import { QueryPlanNode } from '../query-plan'
import { noopTracingHelper } from '../tracing'
import { QueryInterpreter, QueryRuntimeOptions } from './query-interpreter'

const runtimeOptions = {
  queryable: {},
  transactionManager: { enabled: false },
  scope: {},
} as QueryRuntimeOptions

test('uses a per-run generator snapshot for now calls', async () => {
  const interpreter = QueryInterpreter.forSql({ tracingHelper: noopTracingHelper })
  const plan = {
    type: 'value',
    args: [
      { prisma__type: 'generatorCall', prisma__value: { name: 'now', args: [] } },
      { prisma__type: 'generatorCall', prisma__value: { name: 'now', args: [] } },
    ],
  } satisfies QueryPlanNode

  const first = (await interpreter.run(plan, runtimeOptions)) as string[]
  await new Promise((resolve) => setTimeout(resolve, 10))
  const second = (await interpreter.run(plan, runtimeOptions)) as string[]

  expect(first[0]).toBe(first[1])
  expect(second[0]).toBe(second[1])
  expect(first[0]).not.toBe(second[0])
})

test('uses built-in generators without a snapshot when now is absent', async () => {
  const interpreter = QueryInterpreter.forSql({ tracingHelper: noopTracingHelper })
  const plan = {
    type: 'value',
    args: { prisma__type: 'generatorCall', prisma__value: { name: 'product', args: [1, [2, 3]] } },
  } satisfies QueryPlanNode

  await expect(interpreter.run(plan, runtimeOptions)).resolves.toEqual([
    [1, 2],
    [1, 3],
  ])
})

test('applies SQL comments without query instrumentation', async () => {
  const interpreter = QueryInterpreter.forSql({ tracingHelper: noopTracingHelper })
  const plan = {
    type: 'query',
    args: {
      type: 'templateSql',
      fragments: [{ type: 'stringChunk', chunk: 'SELECT 1' }],
      placeholderFormat: { prefix: '?', hasNumbering: false },
      args: [],
      argTypes: [],
      chunkable: false,
    },
  } satisfies QueryPlanNode

  let observedQuery: SqlQuery | undefined
  const queryable: SqlQueryable = {
    provider: 'sqlite',
    adapterName: '@prisma/adapter-test',
    queryRaw(query) {
      observedQuery = query
      return Promise.resolve(emptyResultSet())
    },
    executeRaw() {
      return Promise.resolve(0)
    },
  }

  await interpreter.run(plan, {
    ...runtimeOptions,
    queryable,
    sqlCommenter: {
      plugins: [() => ({ source: 'test' })],
      queryInfo: { type: 'single', modelName: 'User', action: 'findMany', query: {} },
    },
  })

  expect(observedQuery?.sql).toBe("SELECT 1 /*source='test'*/")
})

function emptyResultSet(): SqlResultSet {
  return {
    columnNames: [],
    columnTypes: [],
    rows: [],
  }
}
