import { ColumnTypeEnum, type SqlQuery, type SqlQueryable, type SqlResultSet } from '@prisma/driver-adapter-utils'
import { expect, test } from 'vitest'

import type { PrismaValue, QueryPlanDbQuery, QueryPlanNode } from '../query-plan'
import { noopTracingHelper } from '../tracing'
import { UserFacingError } from '../user-facing-error'
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

test('maps non-raw query driver errors through the outer user-facing handler', async () => {
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

  await expect(interpreter.run(plan, { ...runtimeOptions, queryable: rejectingQueryable() })).rejects.toMatchObject({
    name: 'UserFacingError',
    code: 'P2039',
  } satisfies Partial<UserFacingError>)
})

test('keeps raw query driver errors mapped as raw query failures', async () => {
  const interpreter = QueryInterpreter.forSql({ tracingHelper: noopTracingHelper })
  const plan = {
    type: 'query',
    args: {
      type: 'rawSql',
      sql: 'SELECT 1',
      args: [],
      argTypes: [],
    },
  } satisfies QueryPlanNode

  await expect(interpreter.run(plan, { ...runtimeOptions, queryable: rejectingQueryable() })).rejects.toMatchObject({
    name: 'UserFacingError',
    code: 'P2010',
  } satisfies Partial<UserFacingError>)
})

test('interprets compact expression nodes', async () => {
  const interpreter = QueryInterpreter.forSql({ tracingHelper: noopTracingHelper })
  const plan = [
    'd',
    [
      'u',
      ['q', [['SELECT id, type FROM users WHERE id = ', { type: 'parameter' }], ['?', false], [1], ['int'], false]],
    ],
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

test('interprets compact nested single-child join branches', async () => {
  const interpreter = QueryInterpreter.forSql({ tracingHelper: noopTracingHelper })
  const plan = [
    'l',
    [
      [
        '@parent',
        [
          'v',
          [
            { postId: 1, tagId: 10 },
            { postId: 1, tagId: 11 },
          ],
        ],
      ],
    ],
    [
      'l',
      [['@parent$tagId', ['m', 'tagId', ['g', '@parent']]]],
      [
        'j',
        ['g', '@parent'],
        [
          [
            [
              'v',
              [
                { id: 10, name: 'Rust' },
                { id: 11, name: 'Wasm' },
              ],
            ],
            [['tagId', 'id']],
            '@nested$tag',
            true,
          ],
        ],
        true,
      ],
    ],
  ] satisfies QueryPlanNode

  await expect(interpreter.run(plan, runtimeOptions)).resolves.toEqual([
    { postId: 1, tagId: 10, '@nested$tag': { id: 10, name: 'Rust' } },
    { postId: 1, tagId: 11, '@nested$tag': { id: 11, name: 'Wasm' } },
  ])
})

test('interprets compact mapped join branches', async () => {
  const interpreter = QueryInterpreter.forSql({ tracingHelper: noopTracingHelper })
  const plan = [
    'l',
    [
      [
        '@parent',
        [
          'v',
          {
            id: 1,
            authorId: 10,
          },
        ],
      ],
    ],
    [
      'l',
      [
        ['@parent$authorId', ['m', 'authorId', ['g', '@parent']]],
        ['@parent$id', ['m', 'id', ['g', '@parent']]],
      ],
      [
        'j',
        ['g', '@parent'],
        [
          [['v', { id: 10, name: 'Alice' }], [['authorId', 'id']], '@nested$author', true],
          [
            [
              'v',
              [
                { postId: 1, content: 'Nice' },
                { postId: 1, content: 'Great' },
              ],
            ],
            [['id', 'postId']],
            '@nested$comments',
            false,
          ],
        ],
        true,
      ],
    ],
  ] satisfies QueryPlanNode

  await expect(interpreter.run(plan, runtimeOptions)).resolves.toEqual({
    id: 1,
    authorId: 10,
    '@nested$author': { id: 10, name: 'Alice' },
    '@nested$comments': [
      { postId: 1, content: 'Nice' },
      { postId: 1, content: 'Great' },
    ],
  })
})

test('interprets compact raw nested read nodes', async () => {
  const interpreter = QueryInterpreter.forSql({ tracingHelper: noopTracingHelper })
  const rootQuery = templateQuery('SELECT id, authorId FROM Post WHERE id = ', 1)
  const authorQuery = templateQuery('SELECT id, name FROM User WHERE id = ', { $p: ['@parent$authorId', 'int'] })
  const commentsQuery = templateQuery('SELECT id, postId, content FROM Comment WHERE postId = ', {
    $p: ['@parent$id', 'int'],
  })
  const plan = [
    'n',
    [
      rootQuery,
      [
        ['id', 0],
        ['authorId', 1],
      ],
      [
        [
          'r',
          'author',
          [
            authorQuery,
            [
              ['id', 0],
              ['name', 1],
            ],
          ],
          1,
          0,
          '@parent$authorId',
          true,
        ],
        [
          'r',
          'comments',
          [
            commentsQuery,
            [
              ['id', 0],
              ['postId', 1],
              ['content', 2],
            ],
          ],
          0,
          1,
          '@parent$id',
          false,
        ],
      ],
    ],
    true,
  ] satisfies QueryPlanNode

  const observedQueries: SqlQuery[] = []
  const queryable: SqlQueryable = {
    provider: 'sqlite',
    adapterName: '@prisma/adapter-test',
    queryRaw(query) {
      observedQueries.push(query)
      if (query.sql.startsWith('SELECT id, authorId')) {
        return Promise.resolve({
          columnNames: ['id', 'authorId'],
          columnTypes: [ColumnTypeEnum.Int32, ColumnTypeEnum.Int32],
          rows: [[1, 10]],
        })
      }
      if (query.sql.startsWith('SELECT id, name')) {
        return Promise.resolve({
          columnNames: ['id', 'name'],
          columnTypes: [ColumnTypeEnum.Int32, ColumnTypeEnum.Text],
          rows: [[10, 'Alice']],
        })
      }
      return Promise.resolve({
        columnNames: ['id', 'postId', 'content'],
        columnTypes: [ColumnTypeEnum.Int32, ColumnTypeEnum.Int32, ColumnTypeEnum.Text],
        rows: [
          [100, 1, 'Nice'],
          [101, 1, 'Great'],
        ],
      })
    },
    executeRaw() {
      return Promise.resolve(0)
    },
  }

  await expect(interpreter.run(plan, { ...runtimeOptions, queryable })).resolves.toEqual({
    id: 1,
    authorId: 10,
    author: { id: 10, name: 'Alice' },
    comments: [
      { id: 100, postId: 1, content: 'Nice' },
      { id: 101, postId: 1, content: 'Great' },
    ],
  })
  expect(observedQueries.map((query) => query.args)).toEqual([[1], [10], [1]])
})

test('interprets compact raw nested read many-to-many relations', async () => {
  const interpreter = QueryInterpreter.forSql({ tracingHelper: noopTracingHelper })
  const rootQuery = templateQuery('SELECT id FROM Post WHERE id = ', 1)
  const postTagQuery = templateQuery('SELECT postId, tagId FROM PostTag WHERE postId = ', { $p: ['@parent$id', 'int'] })
  const tagQuery = templateQuery('SELECT id, name FROM Tag WHERE id IN ', { $p: ['@parent$tagId', 'int'] })
  const plan = [
    'n',
    [
      rootQuery,
      [['id', 0]],
      [
        [
          'm',
          'tags',
          postTagQuery,
          [
            tagQuery,
            [
              ['id', 0],
              ['name', 1],
            ],
          ],
          0,
          0,
          1,
          0,
          '@parent$id',
          '@parent$tagId',
        ],
      ],
    ],
    true,
  ] satisfies QueryPlanNode

  const observedQueries: SqlQuery[] = []
  const queryable: SqlQueryable = {
    provider: 'sqlite',
    adapterName: '@prisma/adapter-test',
    queryRaw(query) {
      observedQueries.push(query)
      if (query.sql.startsWith('SELECT id FROM Post')) {
        return Promise.resolve({
          columnNames: ['id'],
          columnTypes: [ColumnTypeEnum.Int32],
          rows: [[1]],
        })
      }
      if (query.sql.startsWith('SELECT postId')) {
        return Promise.resolve({
          columnNames: ['postId', 'tagId'],
          columnTypes: [ColumnTypeEnum.Int32, ColumnTypeEnum.Int32],
          rows: [
            [1, 10],
            [1, 11],
          ],
        })
      }
      return Promise.resolve({
        columnNames: ['id', 'name'],
        columnTypes: [ColumnTypeEnum.Int32, ColumnTypeEnum.Text],
        rows: [
          [10, 'Rust'],
          [11, 'Wasm'],
        ],
      })
    },
    executeRaw() {
      return Promise.resolve(0)
    },
  }

  await expect(interpreter.run(plan, { ...runtimeOptions, queryable })).resolves.toEqual({
    id: 1,
    tags: [
      { id: 10, name: 'Rust' },
      { id: 11, name: 'Wasm' },
    ],
  })
  expect(observedQueries.map((query) => query.args)).toEqual([[1], [1], [[10, 11]]])
})

test('interprets compact raw nested read scalar conversion metadata', async () => {
  const interpreter = QueryInterpreter.forSql({ tracingHelper: noopTracingHelper, resultFormat: 'js' })
  const rootQuery = templateQuery('SELECT createdAt, count FROM Post WHERE id = ', 1)
  const plan = [
    'n',
    [
      rootQuery,
      [
        ['createdAt', 0, 'D'],
        [['_count', 'comments'], 1, 'i'],
      ],
    ],
    true,
  ] satisfies QueryPlanNode

  const queryable: SqlQueryable = {
    provider: 'sqlite',
    adapterName: '@prisma/adapter-test',
    queryRaw() {
      return Promise.resolve({
        columnNames: ['createdAt', 'count'],
        columnTypes: [ColumnTypeEnum.DateTime, ColumnTypeEnum.Int32],
        rows: [['2024-01-01T00:00:00.000', '2']],
      })
    },
    executeRaw() {
      return Promise.resolve(0)
    },
  }

  await expect(interpreter.run(plan, { ...runtimeOptions, queryable })).resolves.toEqual({
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    _count: {
      comments: 2,
    },
  })
})

test('interprets compact raw nested read named column refs', async () => {
  const interpreter = QueryInterpreter.forSql({ tracingHelper: noopTracingHelper })
  const rootQuery = templateQuery('SELECT name, id FROM User WHERE id = ', 1)
  const plan = [
    'n',
    [
      rootQuery,
      [
        ['id', 'id', 'i'],
        ['name', 'name', 's'],
      ],
    ],
    true,
  ] satisfies QueryPlanNode

  const queryable: SqlQueryable = {
    provider: 'sqlite',
    adapterName: '@prisma/adapter-test',
    queryRaw() {
      return Promise.resolve({
        columnNames: ['name', 'id'],
        columnTypes: [ColumnTypeEnum.Text, ColumnTypeEnum.Int32],
        rows: [['Alice', '1']],
      })
    },
    executeRaw() {
      return Promise.resolve(0)
    },
  }

  await expect(interpreter.run(plan, { ...runtimeOptions, queryable })).resolves.toEqual({
    id: 1,
    name: 'Alice',
  })
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

test('joins tiny single strict keys without scalar key collisions', async () => {
  const interpreter = QueryInterpreter.forSql({ tracingHelper: noopTracingHelper })
  const plan = {
    type: 'join',
    args: {
      parent: {
        type: 'value',
        args: [{ id: '1' }, { id: 1 }, { id: null }],
      },
      children: [
        {
          child: {
            type: 'value',
            args: [
              { parentId: '1', value: 'string-one' },
              { parentId: 1, value: 'number-one' },
              { parentId: null, value: 'null-value' },
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

function templateQuery(sqlPrefix: string, arg: PrismaValue): QueryPlanDbQuery {
  return [[sqlPrefix, { type: 'parameter' }], ['?', false], [arg], ['int'], false]
}

function rejectingQueryable(): SqlQueryable {
  return {
    provider: 'sqlite',
    adapterName: '@prisma/adapter-test',
    queryRaw() {
      return Promise.reject(makeUnmappedDatabaseError())
    },
    executeRaw() {
      return Promise.reject(makeUnmappedDatabaseError())
    },
  }
}

function makeUnmappedDatabaseError() {
  return {
    name: 'DriverAdapterError',
    message: 'no such table: User',
    cause: {
      kind: 'sqlite',
      originalCode: '1',
      originalMessage: 'no such table: User',
    },
  }
}
