import { ColumnTypeEnum, type SqlQuery, type SqlQueryable, type SqlResultSet } from '@prisma/driver-adapter-utils'
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

test('uses a per-run generator snapshot for compact now calls', async () => {
  const interpreter = QueryInterpreter.forSql({ tracingHelper: noopTracingHelper })
  const plan = ['v', [{ $g: ['now', []] }, { $g: ['now', []] }]] satisfies QueryPlanNode
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
    args: { $g: ['product', [1, [2, 3]]] },
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
    args: [['SELECT 1'], ['?', false], [], [], false],
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

test('interprets compact expression nodes', async () => {
  const interpreter = QueryInterpreter.forSql({ tracingHelper: noopTracingHelper })
  const plan = [
    'd',
    ['u', ['q', [['SELECT id, type FROM users WHERE id = ', null], ['?', false], [1], ['int'], false]]],
    [
      null,
      {
        id: 'int',
        type: 'string',
      },
    ],
    {},
  ] satisfies QueryPlanNode
  let observedQuery: SqlQuery | undefined
  const queryable: SqlQueryable = {
    provider: 'sqlite',
    adapterName: '@prisma/adapter-test',
    queryRaw(query) {
      observedQuery = query
      return Promise.resolve({
        columnNames: ['id', 'type'],
        columnTypes: [ColumnTypeEnum.Int32, ColumnTypeEnum.Text],
        rows: [[1, 'admin']],
      })
    },
    executeRaw() {
      return Promise.resolve(0)
    },
  }
  await expect(interpreter.run(plan, { ...runtimeOptions, queryable })).resolves.toEqual({ id: 1, type: 'admin' })
  expect(observedQuery).toEqual({
    sql: 'SELECT id, type FROM users WHERE id = ?',
    args: [1],
    argTypes: [{ arity: 'scalar', scalarType: 'int' }],
  })
})

test('interprets compact binding tuples', async () => {
  const interpreter = QueryInterpreter.forSql({ tracingHelper: noopTracingHelper })
  const plan = ['l', [['record', ['v', { id: 1, name: 'Alice' }]]], ['g', 'record']] satisfies QueryPlanNode
  await expect(interpreter.run(plan, runtimeOptions)).resolves.toEqual({ id: 1, name: 'Alice' })
})

test('joins single strict keys without scalar key collisions', async () => {
  const interpreter = QueryInterpreter.forSql({ tracingHelper: noopTracingHelper })
  const plan = {
    type: 'join',
    args: {
      parent: {
        type: 'value',
        args: [{ id: '1' }, { id: 1 }, { id: null }, { id: 'null' }],
      },
      children: [
        {
          child: {
            type: 'value',
            args: [
              { parentId: '1', value: 'string-one' },
              { parentId: 1, value: 'number-one' },
              { parentId: null, value: 'null-value' },
              { parentId: 'null', value: 'string-null' },
            ],
          },
          on: [['id', 'parentId']],
          parentField: 'children',
          isRelationUnique: false,
        },
      ],
      canAssumeStrictEquality: true,
    },
  } satisfies QueryPlanNode
  await expect(interpreter.run(plan, runtimeOptions)).resolves.toEqual([
    { id: '1', children: [{ parentId: '1', value: 'string-one' }] },
    { id: 1, children: [{ parentId: 1, value: 'number-one' }] },
    { id: null, children: [{ parentId: null, value: 'null-value' }] },
    { id: 'null', children: [{ parentId: 'null', value: 'string-null' }] },
  ])
})

test('interprets compact join tuples', async () => {
  const interpreter = QueryInterpreter.forSql({ tracingHelper: noopTracingHelper })
  const plan = [
    'j',
    ['v', [{ id: '1' }, { id: 1 }, { id: null }, { id: 'null' }]],
    [
      [
        [
          'v',
          [
            { parentId: '1', value: 'string-one' },
            { parentId: 1, value: 'number-one' },
            { parentId: null, value: 'null-value' },
            { parentId: 'null', value: 'string-null' },
          ],
        ],
        [['id', 'parentId']],
        'children',
        false,
      ],
    ],
    true,
  ] satisfies QueryPlanNode
  await expect(interpreter.run(plan, runtimeOptions)).resolves.toEqual([
    { id: '1', children: [{ parentId: '1', value: 'string-one' }] },
    { id: 1, children: [{ parentId: 1, value: 'number-one' }] },
    { id: null, children: [{ parentId: null, value: 'null-value' }] },
    { id: 'null', children: [{ parentId: 'null', value: 'string-null' }] },
  ])
})
function emptyResultSet(): SqlResultSet {
  return {
    columnNames: [],
    columnTypes: [],
    rows: [],
  }
}
