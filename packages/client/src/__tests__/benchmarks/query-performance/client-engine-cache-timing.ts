import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'

import {
  type DescriptorBoundMatcher,
  type DescriptorBoundMatcherContext,
  type DescriptorBoundMatcherRegistry,
  dmmfToRuntimeDataModel,
  type QueryCompiler,
  type QueryCompilerConstructor,
  type QueryCompilerOptions,
} from '@prisma/client-common'
import { getDMMF } from '@prisma/client-generator-js'
import type {
  ColumnType,
  ConnectionInfo,
  IsolationLevel,
  SqlDriverAdapter,
  SqlDriverAdapterFactory,
  SqlQuery,
  SqlResultSet,
  Transaction,
  TransactionOptions,
} from '@prisma/driver-adapter-utils'
import { ColumnTypeEnum } from '@prisma/driver-adapter-utils'
import type { JsonQuery } from '@prisma/json-protocol'
import { ParamGraph } from '@prisma/param-graph'
import { buildAndSerializeParamGraph, buildParamGraph } from '@prisma/param-graph-builder'

import {
  type CompactJoinExpression,
  type FieldType,
  getQueryPlanBindingExpr,
  getQueryPlanBindingName,
  noopTracingHelper,
  parameterizeQuery,
  QueryInterpreter,
  type QueryPlanBinding,
  type QueryPlanCompactNode,
  type QueryPlanDbQuery,
  type QueryPlanNode,
  type RawNestedReadQuery,
  type ResultNode,
} from '../../../../../client-engine-runtime/src'
import { applyDataMap, applyDataMapToResultSet } from '../../../../../client-engine-runtime/src/interpreter/data-mapper'
import type { GeneratorRegistrySnapshot } from '../../../../../client-engine-runtime/src/interpreter/generators'
import { renderQuery } from '../../../../../client-engine-runtime/src/interpreter/render-query'
import { serializeSql } from '../../../../../client-engine-runtime/src/interpreter/serialize-sql'
import { ClientEngine } from '../../../runtime/core/engines/client/ClientEngine'
import { LocalExecutor } from '../../../runtime/core/engines/client/LocalExecutor'
import { QueryPlanCache } from '../../../runtime/core/engines/client/query-plan-cache'
import type { EngineConfig } from '../../../runtime/core/engines/common/Engine'
import type { LogEmitter } from '../../../runtime/core/engines/common/types/Events'
import { queryEngineResultDataWasDeserialized } from '../../../runtime/core/engines/common/types/QueryEngine'
import { serializeJsonQuery } from '../../../runtime/core/jsonProtocol/serializeJsonQuery'
import { createExactDescriptorMatcherRegistry } from '../../../runtime/core/model/createExactDescriptorMatcherRegistry'
import { disabledTracingHelper } from '../../../runtime/core/tracing/TracingHelper'
import { getPrismaClient } from '../../../runtime/getPrismaClient'
import { getQueryCompilerWasmConfig, loadQueryCompiler } from './qc-loader'

const BENCHMARK_DATAMODEL = fs.readFileSync(path.join(__dirname, 'schema.prisma'), 'utf-8')
const MEASUREMENT_FILTER = process.env.CLIENT_ENGINE_CACHE_TIMING_FILTER
const USE_ASYNC_BLOG_PAGE_ADAPTER = process.env.CLIENT_ENGINE_CACHE_TIMING_ASYNC_BLOG_PAGE_ADAPTER === '1'
const USE_FRESH_BLOG_PAGE_RESULT_METADATA =
  process.env.CLIENT_ENGINE_CACHE_TIMING_FRESH_BLOG_PAGE_RESULT_METADATA === '1'
const ITERATION_OVERRIDE =
  process.env.CLIENT_ENGINE_CACHE_TIMING_ITERATIONS === undefined
    ? undefined
    : Number.parseInt(process.env.CLIENT_ENGINE_CACHE_TIMING_ITERATIONS, 10)
const EMPTY_RESULT: SqlResultSet = Object.freeze({
  columnNames: [],
  columnTypes: [],
  rows: [],
})
const EMPTY_PLACEHOLDER_VALUES: Record<string, unknown> = Object.freeze({})
const USER_SCALAR_RESULT: SqlResultSet = Object.freeze({
  columnNames: Object.freeze(['id', 'email', 'name']),
  columnTypes: Object.freeze([ColumnTypeEnum.Int32, ColumnTypeEnum.Text, ColumnTypeEnum.Text]) as ColumnType[],
  rows: Object.freeze(
    Array.from({ length: 10 }, (_, index) =>
      Object.freeze([index + 1, `user${index + 1}@example.test`, `User ${index + 1}`]),
    ),
  ) as unknown[][],
})
const USER_UNIQUE_RESULT: SqlResultSet = Object.freeze({
  columnNames: USER_SCALAR_RESULT.columnNames,
  columnTypes: USER_SCALAR_RESULT.columnTypes,
  rows: Object.freeze([USER_SCALAR_RESULT.rows[0]]) as unknown[][],
})
const BLOG_PAGE_POST_RESULT: SqlResultSet = Object.freeze({
  columnNames: Object.freeze([
    'id',
    'title',
    'slug',
    'content',
    'published',
    'viewCount',
    'createdAt',
    'authorId',
    'categoryId',
    '_aggr_count_likes',
    '_aggr_count_comments',
  ]),
  columnTypes: Object.freeze([
    ColumnTypeEnum.Int32,
    ColumnTypeEnum.Text,
    ColumnTypeEnum.Text,
    ColumnTypeEnum.Text,
    ColumnTypeEnum.Boolean,
    ColumnTypeEnum.Int32,
    ColumnTypeEnum.DateTime,
    ColumnTypeEnum.Int32,
    ColumnTypeEnum.Int32,
    ColumnTypeEnum.Int32,
    ColumnTypeEnum.Int32,
  ]) as ColumnType[],
  rows: Object.freeze([
    Object.freeze([1, 'Hello', 'hello', 'Body', true, 7, new Date('2024-01-01T00:00:00.000Z'), 10, 20, 3, 2]),
  ]) as unknown[][],
})
const BLOG_PAGE_AUTHOR_RESULT: SqlResultSet = Object.freeze({
  columnNames: Object.freeze(['id', 'name', 'avatar']),
  columnTypes: Object.freeze([ColumnTypeEnum.Int32, ColumnTypeEnum.Text, ColumnTypeEnum.Text]) as ColumnType[],
  rows: Object.freeze([Object.freeze([10, 'Alice', 'alice.png'])]) as unknown[][],
})
const BLOG_PAGE_CATEGORY_RESULT: SqlResultSet = Object.freeze({
  columnNames: Object.freeze(['id', 'name', 'slug']),
  columnTypes: Object.freeze([ColumnTypeEnum.Int32, ColumnTypeEnum.Text, ColumnTypeEnum.Text]) as ColumnType[],
  rows: Object.freeze([Object.freeze([20, 'Engineering', 'engineering'])]) as unknown[][],
})
const BLOG_PAGE_POST_TAG_RESULT: SqlResultSet = Object.freeze({
  columnNames: Object.freeze(['postId', 'tagId']),
  columnTypes: Object.freeze([ColumnTypeEnum.Int32, ColumnTypeEnum.Int32]) as ColumnType[],
  rows: Object.freeze([Object.freeze([1, 100]), Object.freeze([1, 101])]) as unknown[][],
})
const BLOG_PAGE_TAG_RESULT: SqlResultSet = Object.freeze({
  columnNames: Object.freeze(['id', 'name', 'slug']),
  columnTypes: Object.freeze([ColumnTypeEnum.Int32, ColumnTypeEnum.Text, ColumnTypeEnum.Text]) as ColumnType[],
  rows: Object.freeze([Object.freeze([100, 'Rust', 'rust']), Object.freeze([101, 'Wasm', 'wasm'])]) as unknown[][],
})
const BLOG_PAGE_COMMENT_RESULT: SqlResultSet = Object.freeze({
  columnNames: Object.freeze(['id', 'content', 'createdAt', 'authorId', 'postId']),
  columnTypes: Object.freeze([
    ColumnTypeEnum.Int32,
    ColumnTypeEnum.Text,
    ColumnTypeEnum.DateTime,
    ColumnTypeEnum.Int32,
    ColumnTypeEnum.Int32,
  ]) as ColumnType[],
  rows: Object.freeze([
    Object.freeze([200, 'Nice', new Date('2024-01-02T00:00:00.000Z'), 11, 1]),
    Object.freeze([201, 'Great', new Date('2024-01-03T00:00:00.000Z'), 12, 1]),
  ]) as unknown[][],
})
const BLOG_PAGE_COMMENT_AUTHOR_RESULT: SqlResultSet = Object.freeze({
  columnNames: Object.freeze(['id', 'name', 'avatar']),
  columnTypes: Object.freeze([ColumnTypeEnum.Int32, ColumnTypeEnum.Text, ColumnTypeEnum.Text]) as ColumnType[],
  rows: Object.freeze([
    Object.freeze([11, 'Bob', 'bob.png']),
    Object.freeze([12, 'Carla', 'carla.png']),
  ]) as unknown[][],
})
const BLOG_PAGE_RESULT_SETS: readonly SqlResultSet[] = Object.freeze([
  BLOG_PAGE_POST_RESULT,
  BLOG_PAGE_AUTHOR_RESULT,
  BLOG_PAGE_CATEGORY_RESULT,
  BLOG_PAGE_POST_TAG_RESULT,
  BLOG_PAGE_TAG_RESULT,
  BLOG_PAGE_COMMENT_RESULT,
  BLOG_PAGE_COMMENT_AUTHOR_RESULT,
])
const BLOG_PAGE_QUERY_SELECTORS: readonly SqlQuery[] = Object.freeze([
  Object.freeze({ sql: 'SELECT * FROM `main`.`Post`', args: [], argTypes: [] }),
  Object.freeze({ sql: 'SELECT * FROM `main`.`User`', args: [], argTypes: [] }),
  Object.freeze({ sql: 'SELECT * FROM `main`.`Category`', args: [], argTypes: [] }),
  Object.freeze({ sql: 'SELECT * FROM `main`.`PostTag`', args: [], argTypes: [] }),
  Object.freeze({ sql: 'SELECT * FROM `main`.`Tag`', args: [], argTypes: [] }),
  Object.freeze({ sql: 'SELECT * FROM `main`.`Comment`', args: [], argTypes: [] }),
  Object.freeze({ sql: 'SELECT * FROM `main`.`User` WHERE `id` IN (?)', args: [], argTypes: [] }),
])
const BLOG_PAGE_ROOT_SCALAR_FIELDS = ['id', 'title', 'slug', 'content', 'published', 'viewCount', 'createdAt'] as const
const BLOG_PAGE_RESULT_SET_BY_SQL = new Map<string, SqlResultSet>()

type Counts = {
  compile: number
  compileBatch: number
  queryRaw: number
  executeRaw: number
  precomputedFastPathHits?: number
  precomputedFastPathLearns?: number
  precomputedBatchHits?: number
}

type ScenarioAdapterFactory = (counts: Counts) => SqlDriverAdapterFactory

type Scenario = {
  name: string
  iterations: number
  query: (iteration: number) => JsonQuery
  cacheMaxSize: number
  resultSet?: SqlResultSet
  adapterFactory?: ScenarioAdapterFactory
}

type Measurement = Scenario & {
  elapsedMs: number
  averageUs: number
  counts: Counts
  heapDelta?: number
}

type DirectPlanScenario = {
  name: string
  iterations: number
  query: JsonQuery
  resultSet?: SqlResultSet
  adapterFactory?: ScenarioAdapterFactory
}

type GeneratedClientScenario = DirectPlanScenario & {
  operation: (client: any, iteration: number) => Promise<unknown>
}

type GeneratedClientSerializeScenario = {
  name: string
  iterations: number
  modelName: string
  action: 'findUnique'
  clientMethod: string
  args: (iteration: number) => Record<string, unknown>
  query: (iteration: number) => JsonQuery
  resultSet?: SqlResultSet
  adapterFactory?: ScenarioAdapterFactory
}

type DirectPlanScopeScenario = {
  name: string
  iterations: number
  query: (iteration: number) => JsonQuery
  resultSet?: SqlResultSet
  adapterFactory?: ScenarioAdapterFactory
}

type CacheKeyScenario = {
  name: string
  iterations: number
  query: (iteration: number) => JsonQuery
  staticShapePlaceholderValues?: (iteration: number) => Record<string, unknown>
  resultSet?: SqlResultSet
  adapterFactory?: ScenarioAdapterFactory
}

type ManyShapeCachedRequestScenario = {
  name: string
  iterations: number
  shapeCount: number
  query: (shapeIndex: number, iteration: number) => JsonQuery
  resultSet?: SqlResultSet
  adapterFactory?: ScenarioAdapterFactory
}

type DirectPlanMeasurement = DirectPlanScenario & {
  elapsedMs: number
  averageUs: number
  counts: Counts
  heapDelta?: number
}

type CacheKeyMeasurement = CacheKeyScenario & {
  elapsedMs: number
  averageUs: number
  totalKeyBytes: number
  heapDelta?: number
}

type PhaseMeasurement = CacheKeyScenario & {
  elapsedMs: number
  averageUs: number
  checksum: number
  heapDelta?: number
}

type PlanPhaseMeasurement = {
  name: string
  iterations: number
  elapsedMs: number
  averageUs: number
  checksum: number
  heapDelta?: number
}

type DirectDataMapPlan = {
  expr: QueryPlanNode
  structure: ResultNode
  enums: Record<string, Record<string, string>>
}

type StaticDescriptorExtraction = {
  cacheKey: string
  placeholderValues: Record<string, unknown>
}

type LazyStaticDescriptor = {
  cacheKey: string
  root: LazyDescriptorNode
}

type LazyDescriptorNode =
  | {
      kind: 'constant'
      value: unknown
    }
  | {
      kind: 'placeholder'
      name: string
      valueType: string
    }
  | {
      kind: 'array'
      items: LazyDescriptorNode[]
    }
  | {
      kind: 'object'
      keys: string[]
      fields: Record<string, LazyDescriptorNode>
    }

type GeneratedExactDescriptor =
  | {
      kind: 'constant'
      value: unknown
    }
  | {
      kind: 'placeholder'
      name: string
      valueType: string
    }
  | {
      kind: 'object'
      keys: string[]
      fields: Record<string, GeneratedExactDescriptor>
    }

class EmptySqliteAdapter implements SqlDriverAdapter {
  readonly provider = 'sqlite'
  readonly adapterName = '@prisma/adapter-benchmark-empty'

  constructor(
    private readonly counts: Counts,
    private readonly resultSet: SqlResultSet = EMPTY_RESULT,
  ) {}

  queryRaw(_query: SqlQuery): Promise<SqlResultSet> {
    this.counts.queryRaw++
    return Promise.resolve(this.resultSet)
  }

  executeRaw(_query: SqlQuery): Promise<number> {
    this.counts.executeRaw++
    return Promise.resolve(0)
  }

  executeScript(_script: string): Promise<void> {
    return Promise.resolve()
  }

  startTransaction(_isolationLevel?: IsolationLevel): Promise<Transaction> {
    return Promise.resolve(new EmptyTransaction(this))
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      supportsRelationJoins: false,
    }
  }

  dispose(): Promise<void> {
    return Promise.resolve()
  }
}

class EmptyTransaction implements Transaction {
  readonly provider = 'sqlite'
  readonly adapterName = '@prisma/adapter-benchmark-empty'
  readonly options: TransactionOptions = { usePhantomQuery: false }

  constructor(private readonly adapter: EmptySqliteAdapter) {}

  queryRaw(query: SqlQuery): Promise<SqlResultSet> {
    return this.adapter.queryRaw(query)
  }

  executeRaw(query: SqlQuery): Promise<number> {
    return this.adapter.executeRaw(query)
  }

  commit(): Promise<void> {
    return Promise.resolve()
  }

  rollback(): Promise<void> {
    return Promise.resolve()
  }
}

class BlogPageSqliteAdapter implements SqlDriverAdapter {
  readonly provider = 'sqlite'
  readonly adapterName = '@prisma/adapter-benchmark-blog-page'

  constructor(private readonly counts: Counts) {}

  queryRaw(query: SqlQuery): Promise<SqlResultSet> {
    this.counts.queryRaw++
    const resultSet = getBlogPageResultSetForQuery(query.sql)
    if (USE_ASYNC_BLOG_PAGE_ADAPTER) {
      return new Promise((resolve) => setImmediate(resolve, resultSet))
    }
    return Promise.resolve(resultSet)
  }

  executeRaw(_query: SqlQuery): Promise<number> {
    this.counts.executeRaw++
    if (USE_ASYNC_BLOG_PAGE_ADAPTER) {
      return new Promise((resolve) => setImmediate(resolve, 0))
    }
    return Promise.resolve(0)
  }

  executeScript(_script: string): Promise<void> {
    return Promise.resolve()
  }

  startTransaction(_isolationLevel?: IsolationLevel): Promise<Transaction> {
    return Promise.resolve(new EmptyTransaction(this))
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      supportsRelationJoins: false,
    }
  }

  dispose(): Promise<void> {
    return Promise.resolve()
  }
}

function getBlogPageResultSetForQuery(sql: string): SqlResultSet {
  const resultSet = getBlogPageResultSet(sql)
  if (!USE_FRESH_BLOG_PAGE_RESULT_METADATA) {
    return resultSet
  }

  return {
    columnNames: Object.freeze(resultSet.columnNames.slice()),
    columnTypes: Object.freeze(resultSet.columnTypes.slice()) as ColumnType[],
    rows: resultSet.rows,
    lastInsertId: resultSet.lastInsertId,
  }
}

function createAdapterFactory(counts: Counts, resultSet?: SqlResultSet): SqlDriverAdapterFactory {
  return {
    provider: 'sqlite',
    adapterName: '@prisma/adapter-benchmark-empty',
    connect: () => Promise.resolve(new EmptySqliteAdapter(counts, resultSet)),
  }
}

function createBlogPageAdapterFactory(counts: Counts): SqlDriverAdapterFactory {
  return {
    provider: 'sqlite',
    adapterName: '@prisma/adapter-benchmark-blog-page',
    connect: () => Promise.resolve(new BlogPageSqliteAdapter(counts)),
  }
}

function createAdapter(counts: Counts, resultSet?: SqlResultSet): EmptySqliteAdapter {
  return new EmptySqliteAdapter(counts, resultSet)
}

async function createScenarioAdapter(
  counts: Counts,
  scenario: Pick<Scenario, 'adapterFactory' | 'resultSet'>,
): Promise<SqlDriverAdapter> {
  if (scenario.adapterFactory !== undefined) {
    return scenario.adapterFactory(counts).connect()
  }

  return createAdapter(counts, scenario.resultSet)
}

function getBlogPageResultSet(sql: string): SqlResultSet {
  const cached = BLOG_PAGE_RESULT_SET_BY_SQL.get(sql)
  if (cached !== undefined) {
    return cached
  }

  const fromMain = 'FROM `main`.`'
  const tableStart = sql.indexOf(fromMain)

  if (tableStart !== -1) {
    const tableNameStart = tableStart + fromMain.length
    const tableNameEnd = sql.indexOf('`', tableNameStart)
    const tableName = tableNameEnd === -1 ? sql.slice(tableNameStart) : sql.slice(tableNameStart, tableNameEnd)

    switch (tableName) {
      case 'Post':
        return cacheBlogPageResultSet(sql, projectBlogPageResultSet(sql, BLOG_PAGE_POST_RESULT))
      case 'Category':
        return cacheBlogPageResultSet(sql, projectBlogPageResultSet(sql, BLOG_PAGE_CATEGORY_RESULT))
      case 'PostTag':
        return cacheBlogPageResultSet(sql, projectBlogPageResultSet(sql, BLOG_PAGE_POST_TAG_RESULT))
      case 'Tag':
        return cacheBlogPageResultSet(sql, projectBlogPageResultSet(sql, BLOG_PAGE_TAG_RESULT))
      case 'Comment':
        return cacheBlogPageResultSet(sql, projectBlogPageResultSet(sql, BLOG_PAGE_COMMENT_RESULT))
      case 'User':
        return cacheBlogPageResultSet(
          sql,
          projectBlogPageResultSet(
            sql,
            sql.includes(' IN ') ? BLOG_PAGE_COMMENT_AUTHOR_RESULT : BLOG_PAGE_AUTHOR_RESULT,
          ),
        )
    }
  }

  throw new Error(`Unexpected blog page benchmark SQL: ${sql}`)
}

function projectBlogPageResultSet(sql: string, resultSet: SqlResultSet): SqlResultSet {
  const selectedColumns = getSelectedBlogPageColumns(sql)
  if (selectedColumns === undefined) {
    return resultSet
  }

  if (
    selectedColumns.length === resultSet.columnNames.length &&
    selectedColumns.every((columnName, index) => columnName === resultSet.columnNames[index])
  ) {
    return resultSet
  }

  const sourceColumnIndexes = new Map<string, number>()
  for (let i = 0; i < resultSet.columnNames.length; i++) {
    sourceColumnIndexes.set(resultSet.columnNames[i], i)
  }

  const columnIndexes = selectedColumns.map((columnName) => {
    const columnIndex = sourceColumnIndexes.get(columnName)
    if (columnIndex === undefined) {
      throw new Error(`Unexpected blog page benchmark column '${columnName}' in SQL: ${sql}`)
    }
    return columnIndex
  })

  return {
    columnNames: Object.freeze(selectedColumns.slice()),
    columnTypes: Object.freeze(columnIndexes.map((columnIndex) => resultSet.columnTypes[columnIndex])) as ColumnType[],
    rows: Object.freeze(
      resultSet.rows.map((row) => Object.freeze(columnIndexes.map((columnIndex) => row[columnIndex]))),
    ),
  }
}

function getSelectedBlogPageColumns(sql: string): string[] | undefined {
  const selectPrefix = 'SELECT '
  if (!sql.startsWith(selectPrefix)) {
    return undefined
  }

  const fromIndex = sql.indexOf(' FROM ')
  if (fromIndex === -1) {
    return undefined
  }

  const selection = sql.slice(selectPrefix.length, fromIndex)
  if (selection.trim() === '*') {
    return undefined
  }

  return splitSqlProjection(selection).map(getSqlProjectionColumnName)
}

function splitSqlProjection(selection: string): string[] {
  const projections: string[] = []
  let depth = 0
  let start = 0
  let inBackticks = false
  for (let i = 0; i < selection.length; i++) {
    const char = selection[i]
    if (char === '`') {
      inBackticks = !inBackticks
    } else if (!inBackticks) {
      if (char === '(') {
        depth++
      } else if (char === ')') {
        depth--
      } else if (char === ',' && depth === 0) {
        projections.push(selection.slice(start, i).trim())
        start = i + 1
      }
    }
  }
  projections.push(selection.slice(start).trim())
  return projections
}

function getSqlProjectionColumnName(projection: string): string {
  const aliasMatch = projection.match(/\sAS\s`([^`]+)`$/)
  if (aliasMatch !== null) {
    return aliasMatch[1]
  }

  const lastBacktickStart = projection.lastIndexOf('`')
  const previousBacktickStart = projection.lastIndexOf('`', lastBacktickStart - 1)
  if (lastBacktickStart !== -1 && previousBacktickStart !== -1) {
    return projection.slice(previousBacktickStart + 1, lastBacktickStart)
  }

  throw new Error(`Unexpected blog page benchmark projection: ${projection}`)
}

function cacheBlogPageResultSet(sql: string, resultSet: SqlResultSet): SqlResultSet {
  BLOG_PAGE_RESULT_SET_BY_SQL.set(sql, resultSet)
  return resultSet
}

async function createCountingQueryCompilerLoader(counts: Counts) {
  const QueryCompilerClass = await loadQueryCompiler('sqlite')

  const CountingQueryCompiler: QueryCompilerConstructor = class implements QueryCompiler {
    readonly #compiler: QueryCompiler

    constructor(options: QueryCompilerOptions) {
      this.#compiler = new QueryCompilerClass(options)
    }

    compile(request: string) {
      counts.compile++
      return this.#compiler.compile(request)
    }

    compileBatch(request: string) {
      counts.compileBatch++
      return this.#compiler.compileBatch(request)
    }

    free() {
      this.#compiler.free()
    }
  }

  return {
    loadQueryCompiler: () => Promise.resolve(CountingQueryCompiler),
  }
}

function createFindUniqueQuery(id: number): JsonQuery {
  return {
    modelName: 'User',
    action: 'findUnique',
    query: {
      arguments: {
        where: { id },
      },
      selection: {
        id: true,
        email: true,
        name: true,
      },
    },
  }
}

function createFindManyUsersQuery(): JsonQuery {
  return {
    modelName: 'User',
    action: 'findMany',
    query: {
      arguments: {
        take: 10,
      },
      selection: {
        id: true,
        email: true,
        name: true,
      },
    },
  }
}

function addBlogPostPageNestedSelection(selection: Record<string, unknown>): void {
  selection.author = {
    selection: {
      id: true,
      name: true,
      avatar: true,
    },
  }
  selection.category = {
    selection: {
      id: true,
      name: true,
      slug: true,
    },
  }
  selection.tags = {
    selection: {
      tag: {
        selection: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  }
  selection.comments = {
    arguments: {
      take: 10,
      orderBy: [{ createdAt: 'desc' }],
    },
    selection: {
      id: true,
      content: true,
      createdAt: true,
      author: {
        selection: {
          id: true,
          name: true,
          avatar: true,
        },
      },
    },
  }
  selection._count = {
    selection: {
      likes: true,
      comments: true,
    },
  }
}

function createBlogPostPageQueryWithSelection(id: number, selection: Record<string, unknown>): JsonQuery {
  addBlogPostPageNestedSelection(selection)

  return {
    modelName: 'Post',
    action: 'findUnique',
    query: {
      arguments: {
        where: { id },
      },
      selection: {
        ...selection,
      },
    },
  }
}

function createBlogPostPageQuery(id: number): JsonQuery {
  const selection: Record<string, unknown> = {}
  for (const field of BLOG_PAGE_ROOT_SCALAR_FIELDS) {
    selection[field] = true
  }

  return createBlogPostPageQueryWithSelection(id, selection)
}

function createBlogPostPageRootMaskQuery(mask: number, id: number): JsonQuery {
  const selection: Record<string, unknown> = {}

  for (let i = 0; i < BLOG_PAGE_ROOT_SCALAR_FIELDS.length; i++) {
    if ((mask & (1 << i)) !== 0) {
      selection[BLOG_PAGE_ROOT_SCALAR_FIELDS[i]] = true
    }
  }

  if (Object.keys(selection).length === 0) {
    selection.id = true
  }

  return createBlogPostPageQueryWithSelection(id, selection)
}

function createGeneratedFindUniqueArgs(iteration: number): Record<string, unknown> {
  return {
    where: { id: iteration + 1 },
    select: {
      id: true,
      email: true,
      name: true,
    },
  }
}

function createGeneratedFindManyUsersArgs(): Record<string, unknown> {
  return {
    take: 10,
    select: {
      id: true,
      email: true,
      name: true,
    },
  }
}

function createGeneratedBlogPostPageArgs(iteration: number): Record<string, unknown> {
  return createGeneratedBlogPostPageRootMaskArgs((1 << BLOG_PAGE_ROOT_SCALAR_FIELDS.length) - 1, iteration)
}

function createGeneratedBlogPostPageRootMaskArgs(mask: number, iteration: number): Record<string, unknown> {
  const select: Record<string, unknown> = {}
  for (let i = 0; i < BLOG_PAGE_ROOT_SCALAR_FIELDS.length; i++) {
    if ((mask & (1 << i)) !== 0) {
      select[BLOG_PAGE_ROOT_SCALAR_FIELDS[i]] = true
    }
  }

  if (Object.keys(select).length === 0) {
    select.id = true
  }

  select.author = {
    select: {
      id: true,
      name: true,
      avatar: true,
    },
  }
  select.category = {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  }
  select.tags = {
    select: {
      tag: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  }
  select.comments = {
    take: 10,
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: {
        select: {
          id: true,
          name: true,
          avatar: true,
        },
      },
    },
  }
  select._count = {
    select: {
      likes: true,
      comments: true,
    },
  }

  return {
    where: { id: iteration + 1 },
    select,
  }
}

const BLOG_PAGE_ROOT_SELECT_KEYS = [
  'id',
  'title',
  'slug',
  'content',
  'published',
  'viewCount',
  'createdAt',
  'author',
  'category',
  'tags',
  'comments',
  '_count',
] as const
const BLOG_PAGE_MINIMAL_ROOT_SELECT_KEYS = ['id', 'title', 'author', 'category', 'tags', 'comments', '_count'] as const
const BLOG_PAGE_USER_SELECT_KEYS = ['id', 'name', 'avatar'] as const
const BLOG_PAGE_SLUG_SELECT_KEYS = ['id', 'name', 'slug'] as const
const BLOG_PAGE_COMMENT_SELECT_KEYS = ['id', 'content', 'createdAt', 'author'] as const
const BLOG_PAGE_COUNT_SELECT_KEYS = ['likes', 'comments'] as const

function tryExtractGeneratedBlogPostPageDescriptor(
  args: Record<string, unknown>,
  cacheKey: string,
): StaticDescriptorExtraction | undefined {
  if (!hasExactKeys(args, ['where', 'select'])) {
    return undefined
  }

  const where = args.where
  if (!isDescriptorRecord(where) || !hasExactKeys(where, ['id']) || typeof where.id !== 'number') {
    return undefined
  }

  const select = args.select
  if (!isDescriptorRecord(select) || !hasExactKeys(select, BLOG_PAGE_ROOT_SELECT_KEYS)) {
    return undefined
  }

  for (const field of BLOG_PAGE_ROOT_SCALAR_FIELDS) {
    if (select[field] !== true) {
      return undefined
    }
  }

  if (
    !matchesSelectObject(select.author, BLOG_PAGE_USER_SELECT_KEYS) ||
    !matchesSelectObject(select.category, BLOG_PAGE_SLUG_SELECT_KEYS) ||
    !matchesBlogPageTagsSelection(select.tags) ||
    !matchesBlogPageCommentsSelection(select.comments) ||
    !matchesSelectObject(select._count, BLOG_PAGE_COUNT_SELECT_KEYS)
  ) {
    return undefined
  }

  return {
    cacheKey,
    placeholderValues: { '%1': where.id },
  }
}

function createBenchmarkDescriptorBoundMatcherRegistry(): DescriptorBoundMatcherRegistry {
  return {
    getMatcher(context) {
      const expectedPlaceholders = context.precomputedQueryPlanCacheHit.placeholderValues

      if (context.model === 'User' && context.action === 'findUnique' && context.clientMethod === 'user.findUnique') {
        return (args) => matchGeneratedUserFindUnique(args, expectedPlaceholders)
      }

      if (context.model === 'User' && context.action === 'findMany' && context.clientMethod === 'user.findMany') {
        return (args) => matchGeneratedUserFindMany(args, expectedPlaceholders)
      }

      if (context.model === 'Post' && context.action === 'findUnique' && context.clientMethod === 'post.findUnique') {
        return (args) => matchGeneratedBlogPostPage(args, expectedPlaceholders)
      }

      return undefined
    },
  }
}

function createExactGeneratedUserDescriptorMatcherRegistry(): DescriptorBoundMatcherRegistry {
  return {
    getMatcher(context) {
      if (context.model === 'User' && context.action === 'findUnique' && context.clientMethod === 'user.findUnique') {
        return bindExactGeneratedUserFindUniqueMatcher(context)
      }

      if (context.model === 'User' && context.action === 'findMany' && context.clientMethod === 'user.findMany') {
        return bindExactGeneratedUserFindManyMatcher(context)
      }

      if (context.model === 'Post' && context.action === 'findUnique' && context.clientMethod === 'post.findUnique') {
        return bindExactGeneratedBlogPostPageMatcher(context)
      }

      return undefined
    },
  }
}

function bindExactGeneratedUserFindUniqueMatcher(
  context: DescriptorBoundMatcherContext,
): DescriptorBoundMatcher | undefined {
  const root = getGeneratedExactRoot(context)
  if (root === undefined || !generatedDescriptorHasKeys(root, ['where', 'select'])) {
    return undefined
  }

  const where = asGeneratedObjectDescriptor(root.fields.where)
  if (where === undefined || !generatedDescriptorHasKeys(where, ['id'])) {
    return undefined
  }

  const id = asGeneratedPlaceholderDescriptor(where.fields.id)
  if (
    id === undefined ||
    id.valueType !== 'number' ||
    !isExactGeneratedUserScalarSelectDescriptor(root.fields.select)
  ) {
    return undefined
  }

  return (args) => matchExactGeneratedUserFindUnique(args, id.name)
}

function bindExactGeneratedUserFindManyMatcher(
  context: DescriptorBoundMatcherContext,
): DescriptorBoundMatcher | undefined {
  const root = getGeneratedExactRoot(context)
  if (root === undefined || !generatedDescriptorHasKeys(root, ['take', 'select'])) {
    return undefined
  }

  if (!isExactGeneratedUserScalarSelectDescriptor(root.fields.select)) {
    return undefined
  }

  const take = root.fields.take
  const takePlaceholder = asGeneratedPlaceholderDescriptor(take)
  if (takePlaceholder !== undefined) {
    return takePlaceholder.valueType === 'number'
      ? (args) => matchExactGeneratedUserFindManyWithTakePlaceholder(args, takePlaceholder.name)
      : undefined
  }

  return isGeneratedConstantDescriptor(take, 10)
    ? (args) => matchExactGeneratedUserFindManyWithConstantTake(args)
    : undefined
}

function bindExactGeneratedBlogPostPageMatcher(
  context: DescriptorBoundMatcherContext,
): DescriptorBoundMatcher | undefined {
  const root = getGeneratedExactRoot(context)
  if (root === undefined || !generatedDescriptorHasKeysInOrder(root, ['where', 'select'])) {
    return undefined
  }

  const where = asGeneratedObjectDescriptor(root.fields.where)
  if (where === undefined || !generatedDescriptorHasKeysInOrder(where, ['id'])) {
    return undefined
  }

  const id = asGeneratedPlaceholderDescriptor(where.fields.id)
  const selectShape = getExactGeneratedBlogPostPageSelectDescriptorShape(root.fields.select)
  if (id === undefined || id.valueType !== 'number' || selectShape === undefined) {
    return undefined
  }

  return (args) => matchExactGeneratedBlogPostPage(args, id.name, selectShape)
}

function matchExactGeneratedUserFindUnique(args: unknown, idPlaceholder: string): Record<string, unknown> | undefined {
  if (!isDescriptorRecord(args) || !hasOwnEnumerableKeysInOrder2(args, 'where', 'select')) {
    return undefined
  }

  const where = args.where
  if (!isDescriptorRecord(where) || !hasOwnEnumerableKeysInOrder1(where, 'id') || typeof where.id !== 'number') {
    return undefined
  }

  if (!matchesExactGeneratedUserScalarSelect(args.select)) {
    return undefined
  }

  return { [idPlaceholder]: where.id }
}

function matchExactGeneratedUserFindManyWithTakePlaceholder(
  args: unknown,
  takePlaceholder: string,
): Record<string, unknown> | undefined {
  if (
    !isDescriptorRecord(args) ||
    !hasOwnEnumerableKeysInOrder2(args, 'take', 'select') ||
    typeof args.take !== 'number'
  ) {
    return undefined
  }

  if (!matchesExactGeneratedUserScalarSelect(args.select)) {
    return undefined
  }

  return { [takePlaceholder]: args.take }
}

function matchExactGeneratedUserFindManyWithConstantTake(args: unknown): Record<string, unknown> | undefined {
  if (!isDescriptorRecord(args) || !hasOwnEnumerableKeysInOrder2(args, 'take', 'select') || args.take !== 10) {
    return undefined
  }

  if (!matchesExactGeneratedUserScalarSelect(args.select)) {
    return undefined
  }

  return EMPTY_PLACEHOLDER_VALUES
}

function matchExactGeneratedBlogPostPage(
  args: unknown,
  idPlaceholder: string,
  selectShape: BlogPageRootSelectShape,
): Record<string, unknown> | undefined {
  if (!isDescriptorRecord(args) || !hasOwnEnumerableKeysInOrder2(args, 'where', 'select')) {
    return undefined
  }

  const where = args.where
  if (!isDescriptorRecord(where) || !hasOwnEnumerableKeysInOrder1(where, 'id') || typeof where.id !== 'number') {
    return undefined
  }

  if (!matchesExactGeneratedBlogPostPageSelect(args.select, selectShape)) {
    return undefined
  }

  return { [idPlaceholder]: where.id }
}

function matchesExactGeneratedUserScalarSelect(value: unknown): boolean {
  return (
    isDescriptorRecord(value) &&
    hasOwnEnumerableKeysInOrder3(value, 'id', 'email', 'name') &&
    value.id === true &&
    value.email === true &&
    value.name === true
  )
}

type BlogPageRootSelectShape = 'full' | 'minimal'

function matchesExactGeneratedBlogPostPageSelect(value: unknown, selectShape: BlogPageRootSelectShape): boolean {
  if (!isDescriptorRecord(value)) {
    return false
  }

  if (selectShape === 'full') {
    if (!hasOwnEnumerableKeysInOrder12(value)) {
      return false
    }

    for (let i = 0; i < BLOG_PAGE_ROOT_SCALAR_FIELDS.length; i++) {
      if (value[BLOG_PAGE_ROOT_SCALAR_FIELDS[i]] !== true) {
        return false
      }
    }
  } else {
    if (
      !hasOwnEnumerableKeysInOrder7(value, 'id', 'title', 'author', 'category', 'tags', 'comments', '_count') ||
      value.id !== true ||
      value.title !== true
    ) {
      return false
    }
  }

  return (
    matchesExactGeneratedSelectionWrapper3(value.author, 'id', 'name', 'avatar') &&
    matchesExactGeneratedSelectionWrapper3(value.category, 'id', 'name', 'slug') &&
    matchesExactGeneratedBlogPageTagsSelection(value.tags) &&
    matchesExactGeneratedBlogPageCommentsSelection(value.comments) &&
    matchesExactGeneratedSelectionWrapper2(value._count, 'likes', 'comments')
  )
}

function matchesExactGeneratedBlogPageTagsSelection(value: unknown): boolean {
  if (!isDescriptorRecord(value) || !hasOwnEnumerableKeysInOrder1(value, 'select')) {
    return false
  }

  const select = value.select
  if (!isDescriptorRecord(select) || !hasOwnEnumerableKeysInOrder1(select, 'tag')) {
    return false
  }

  return matchesExactGeneratedSelectionWrapper3(select.tag, 'id', 'name', 'slug')
}

function matchesExactGeneratedBlogPageCommentsSelection(value: unknown): boolean {
  if (
    !isDescriptorRecord(value) ||
    !hasOwnEnumerableKeysInOrder3(value, 'take', 'orderBy', 'select') ||
    value.take !== 10
  ) {
    return false
  }

  const orderBy = value.orderBy
  if (Array.isArray(orderBy) && orderBy.length === 1) {
    const firstOrderBy = orderBy[0]
    if (
      !isDescriptorRecord(firstOrderBy) ||
      !hasOwnEnumerableKeysInOrder1(firstOrderBy, 'createdAt') ||
      firstOrderBy.createdAt !== 'desc'
    ) {
      return false
    }
  } else {
    return false
  }

  const select = value.select
  return (
    isDescriptorRecord(select) &&
    hasOwnEnumerableKeysInOrder4(select, 'id', 'content', 'createdAt', 'author') &&
    select.id === true &&
    select.content === true &&
    select.createdAt === true &&
    matchesExactGeneratedSelectionWrapper3(select.author, 'id', 'name', 'avatar')
  )
}

function matchesExactGeneratedSelectionWrapper2(value: unknown, key0: string, key1: string): boolean {
  if (!isDescriptorRecord(value) || !hasOwnEnumerableKeysInOrder1(value, 'select')) {
    return false
  }

  const select = value.select
  return (
    isDescriptorRecord(select) &&
    hasOwnEnumerableKeysInOrder2(select, key0, key1) &&
    select[key0] === true &&
    select[key1] === true
  )
}

function matchesExactGeneratedSelectionWrapper3(value: unknown, key0: string, key1: string, key2: string): boolean {
  if (!isDescriptorRecord(value) || !hasOwnEnumerableKeysInOrder1(value, 'select')) {
    return false
  }

  const select = value.select
  return (
    isDescriptorRecord(select) &&
    hasOwnEnumerableKeysInOrder3(select, key0, key1, key2) &&
    select[key0] === true &&
    select[key1] === true &&
    select[key2] === true
  )
}

function getGeneratedExactRoot(
  context: DescriptorBoundMatcherContext,
): Extract<GeneratedExactDescriptor, { kind: 'object' }> | undefined {
  if (!isDescriptorRecord(context.descriptor)) {
    return undefined
  }

  return asGeneratedObjectDescriptor(context.descriptor.root)
}

function getExactGeneratedBlogPostPageSelectDescriptorShape(value: unknown): BlogPageRootSelectShape | undefined {
  const select = asGeneratedObjectDescriptor(value)
  if (select === undefined) {
    return undefined
  }

  let selectShape: BlogPageRootSelectShape

  if (generatedDescriptorHasKeysInOrder(select, BLOG_PAGE_ROOT_SELECT_KEYS)) {
    for (let i = 0; i < BLOG_PAGE_ROOT_SCALAR_FIELDS.length; i++) {
      if (!isGeneratedConstantDescriptor(select.fields[BLOG_PAGE_ROOT_SCALAR_FIELDS[i]], true)) {
        return undefined
      }
    }
    selectShape = 'full'
  } else if (generatedDescriptorHasKeysInOrder(select, BLOG_PAGE_MINIMAL_ROOT_SELECT_KEYS)) {
    if (
      !isGeneratedConstantDescriptor(select.fields.id, true) ||
      !isGeneratedConstantDescriptor(select.fields.title, true)
    ) {
      return undefined
    }
    selectShape = 'minimal'
  } else {
    return undefined
  }

  return isExactGeneratedSelectionWrapperDescriptor(select.fields.author, BLOG_PAGE_USER_SELECT_KEYS) &&
    isExactGeneratedSelectionWrapperDescriptor(select.fields.category, BLOG_PAGE_SLUG_SELECT_KEYS) &&
    isExactGeneratedBlogPageTagsSelectionDescriptor(select.fields.tags) &&
    isExactGeneratedBlogPageCommentsSelectionDescriptor(select.fields.comments) &&
    isExactGeneratedSelectionWrapperDescriptor(select.fields._count, BLOG_PAGE_COUNT_SELECT_KEYS)
    ? selectShape
    : undefined
}

function isExactGeneratedUserScalarSelectDescriptor(value: unknown): boolean {
  const select = asGeneratedObjectDescriptor(value)
  return (
    select !== undefined &&
    generatedDescriptorHasKeysInOrder(select, ['id', 'email', 'name']) &&
    isGeneratedConstantDescriptor(select.fields.id, true) &&
    isGeneratedConstantDescriptor(select.fields.email, true) &&
    isGeneratedConstantDescriptor(select.fields.name, true)
  )
}

function isExactGeneratedBlogPageTagsSelectionDescriptor(value: unknown): boolean {
  const root = asGeneratedObjectDescriptor(value)
  if (root === undefined || !generatedDescriptorHasKeysInOrder(root, ['select'])) {
    return false
  }

  const select = asGeneratedObjectDescriptor(root.fields.select)
  return (
    select !== undefined &&
    generatedDescriptorHasKeysInOrder(select, ['tag']) &&
    isExactGeneratedSelectionWrapperDescriptor(select.fields.tag, BLOG_PAGE_SLUG_SELECT_KEYS)
  )
}

function isExactGeneratedBlogPageCommentsSelectionDescriptor(value: unknown): boolean {
  const root = asGeneratedObjectDescriptor(value)
  if (
    root === undefined ||
    !generatedDescriptorHasKeysInOrder(root, ['take', 'orderBy', 'select']) ||
    !isGeneratedConstantDescriptor(root.fields.take, 10)
  ) {
    return false
  }

  const orderBy = asGeneratedArrayDescriptor(root.fields.orderBy)
  if (orderBy === undefined || orderBy.items.length !== 1) {
    return false
  }

  const firstOrderBy = asGeneratedObjectDescriptor(orderBy.items[0])
  if (
    firstOrderBy === undefined ||
    !generatedDescriptorHasKeysInOrder(firstOrderBy, ['createdAt']) ||
    !isGeneratedConstantDescriptor(firstOrderBy.fields.createdAt, 'desc')
  ) {
    return false
  }

  const select = asGeneratedObjectDescriptor(root.fields.select)
  return (
    select !== undefined &&
    generatedDescriptorHasKeysInOrder(select, BLOG_PAGE_COMMENT_SELECT_KEYS) &&
    isGeneratedConstantDescriptor(select.fields.id, true) &&
    isGeneratedConstantDescriptor(select.fields.content, true) &&
    isGeneratedConstantDescriptor(select.fields.createdAt, true) &&
    isExactGeneratedSelectionWrapperDescriptor(select.fields.author, BLOG_PAGE_USER_SELECT_KEYS)
  )
}

function isExactGeneratedSelectionWrapperDescriptor(value: unknown, keys: readonly string[]): boolean {
  const root = asGeneratedObjectDescriptor(value)
  if (root === undefined || !generatedDescriptorHasKeysInOrder(root, ['select'])) {
    return false
  }

  const select = asGeneratedObjectDescriptor(root.fields.select)
  if (select === undefined || !generatedDescriptorHasKeysInOrder(select, keys)) {
    return false
  }

  for (let i = 0; i < keys.length; i++) {
    if (!isGeneratedConstantDescriptor(select.fields[keys[i]], true)) {
      return false
    }
  }

  return true
}

function asGeneratedObjectDescriptor(
  value: unknown,
): Extract<GeneratedExactDescriptor, { kind: 'object' }> | undefined {
  if (
    isDescriptorRecord(value) &&
    value.kind === 'object' &&
    Array.isArray(value.keys) &&
    isDescriptorRecord(value.fields)
  ) {
    return value as Extract<GeneratedExactDescriptor, { kind: 'object' }>
  }

  return undefined
}

function asGeneratedPlaceholderDescriptor(
  value: unknown,
): Extract<GeneratedExactDescriptor, { kind: 'placeholder' }> | undefined {
  if (
    isDescriptorRecord(value) &&
    value.kind === 'placeholder' &&
    typeof value.name === 'string' &&
    typeof value.valueType === 'string'
  ) {
    return value as Extract<GeneratedExactDescriptor, { kind: 'placeholder' }>
  }

  return undefined
}

function asGeneratedArrayDescriptor(value: unknown): Extract<GeneratedExactDescriptor, { kind: 'array' }> | undefined {
  if (isDescriptorRecord(value) && value.kind === 'array' && Array.isArray(value.items)) {
    return value as Extract<GeneratedExactDescriptor, { kind: 'array' }>
  }

  return undefined
}

function isGeneratedConstantDescriptor(value: unknown, expected: unknown): boolean {
  return isDescriptorRecord(value) && value.kind === 'constant' && Object.is(value.value, expected)
}

function generatedDescriptorHasKeys(
  descriptor: Extract<GeneratedExactDescriptor, { kind: 'object' }>,
  expectedKeys: readonly string[],
): boolean {
  if (descriptor.keys.length !== expectedKeys.length) {
    return false
  }

  for (const key of expectedKeys) {
    if (!Object.hasOwn(descriptor.fields, key)) {
      return false
    }
  }

  return true
}

function generatedDescriptorHasKeysInOrder(
  descriptor: Extract<GeneratedExactDescriptor, { kind: 'object' }>,
  expectedKeys: readonly string[],
): boolean {
  if (descriptor.keys.length !== expectedKeys.length) {
    return false
  }

  for (let i = 0; i < expectedKeys.length; i++) {
    const key = expectedKeys[i]
    if (descriptor.keys[i] !== key || !Object.hasOwn(descriptor.fields, key)) {
      return false
    }
  }

  return true
}

function hasOwnEnumerableKeysInOrder1(value: Record<string, unknown>, key0: string): boolean {
  const keys = Object.keys(value)
  return keys.length === 1 && keys[0] === key0
}

function hasOwnEnumerableKeysInOrder2(value: Record<string, unknown>, key0: string, key1: string): boolean {
  const keys = Object.keys(value)
  return keys.length === 2 && keys[0] === key0 && keys[1] === key1
}

function hasOwnEnumerableKeysInOrder3(
  value: Record<string, unknown>,
  key0: string,
  key1: string,
  key2: string,
): boolean {
  const keys = Object.keys(value)
  return keys.length === 3 && keys[0] === key0 && keys[1] === key1 && keys[2] === key2
}

function hasOwnEnumerableKeysInOrder4(
  value: Record<string, unknown>,
  key0: string,
  key1: string,
  key2: string,
  key3: string,
): boolean {
  const keys = Object.keys(value)
  return keys.length === 4 && keys[0] === key0 && keys[1] === key1 && keys[2] === key2 && keys[3] === key3
}

function hasOwnEnumerableKeysInOrder7(
  value: Record<string, unknown>,
  key0: string,
  key1: string,
  key2: string,
  key3: string,
  key4: string,
  key5: string,
  key6: string,
): boolean {
  const keys = Object.keys(value)
  return (
    keys.length === 7 &&
    keys[0] === key0 &&
    keys[1] === key1 &&
    keys[2] === key2 &&
    keys[3] === key3 &&
    keys[4] === key4 &&
    keys[5] === key5 &&
    keys[6] === key6
  )
}

function hasOwnEnumerableKeysInOrder12(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value)
  return (
    keys.length === 12 &&
    keys[0] === 'id' &&
    keys[1] === 'title' &&
    keys[2] === 'slug' &&
    keys[3] === 'content' &&
    keys[4] === 'published' &&
    keys[5] === 'viewCount' &&
    keys[6] === 'createdAt' &&
    keys[7] === 'author' &&
    keys[8] === 'category' &&
    keys[9] === 'tags' &&
    keys[10] === 'comments' &&
    keys[11] === '_count'
  )
}

function matchGeneratedUserFindUnique(
  args: unknown,
  expectedPlaceholders: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!isDescriptorRecord(args) || !hasExactOwnEnumerableKeys(args, ['where', 'select'])) {
    return undefined
  }

  const where = args.where
  if (!isDescriptorRecord(where) || !hasExactOwnEnumerableKeys(where, ['id']) || typeof where.id !== 'number') {
    return undefined
  }

  if (!matchesTrueSelection(args.select, ['id', 'email', 'name'])) {
    return undefined
  }

  return singlePlaceholderValues(expectedPlaceholders, where.id)
}

function matchGeneratedUserFindMany(
  args: unknown,
  expectedPlaceholders: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!isDescriptorRecord(args) || !hasExactOwnEnumerableKeys(args, ['take', 'select']) || args.take !== 10) {
    return undefined
  }

  if (!matchesTrueSelection(args.select, ['id', 'email', 'name'])) {
    return undefined
  }

  return constantPlaceholderValues(expectedPlaceholders)
}

function matchGeneratedBlogPostPage(
  args: unknown,
  expectedPlaceholders: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!isDescriptorRecord(args) || !hasExactOwnEnumerableKeys(args, ['where', 'select'])) {
    return undefined
  }

  const where = args.where
  if (!isDescriptorRecord(where) || !hasExactOwnEnumerableKeys(where, ['id']) || typeof where.id !== 'number') {
    return undefined
  }

  const select = args.select
  if (!isDescriptorRecord(select) || !hasExactOwnEnumerableKeys(select, BLOG_PAGE_ROOT_SELECT_KEYS)) {
    return undefined
  }

  for (const field of BLOG_PAGE_ROOT_SCALAR_FIELDS) {
    if (select[field] !== true) {
      return undefined
    }
  }

  if (
    !matchesSelectionWrapper(select.author, BLOG_PAGE_USER_SELECT_KEYS) ||
    !matchesSelectionWrapper(select.category, BLOG_PAGE_SLUG_SELECT_KEYS) ||
    !matchesBlogPageTagsSelectionFast(select.tags) ||
    !matchesBlogPageCommentsSelectionFast(select.comments) ||
    !matchesSelectionWrapper(select._count, BLOG_PAGE_COUNT_SELECT_KEYS)
  ) {
    return undefined
  }

  return singlePlaceholderValues(expectedPlaceholders, where.id)
}

function matchesBlogPageTagsSelectionFast(value: unknown): boolean {
  if (!isDescriptorRecord(value) || !hasExactOwnEnumerableKeys(value, ['select'])) {
    return false
  }

  const select = value.select
  if (!isDescriptorRecord(select) || !hasExactOwnEnumerableKeys(select, ['tag'])) {
    return false
  }

  return matchesSelectionWrapper(select.tag, BLOG_PAGE_SLUG_SELECT_KEYS)
}

function matchesBlogPageCommentsSelectionFast(value: unknown): boolean {
  if (
    !isDescriptorRecord(value) ||
    !hasExactOwnEnumerableKeys(value, ['take', 'orderBy', 'select']) ||
    value.take !== 10
  ) {
    return false
  }

  const orderBy = value.orderBy
  if (!Array.isArray(orderBy) || orderBy.length !== 1) {
    return false
  }

  const firstOrderBy = orderBy[0]
  if (
    !isDescriptorRecord(firstOrderBy) ||
    !hasExactOwnEnumerableKeys(firstOrderBy, ['createdAt']) ||
    firstOrderBy.createdAt !== 'desc'
  ) {
    return false
  }

  const select = value.select
  if (!isDescriptorRecord(select) || !hasExactOwnEnumerableKeys(select, BLOG_PAGE_COMMENT_SELECT_KEYS)) {
    return false
  }

  return (
    select.id === true &&
    select.content === true &&
    select.createdAt === true &&
    matchesSelectionWrapper(select.author, BLOG_PAGE_USER_SELECT_KEYS)
  )
}

function matchesSelectionWrapper(value: unknown, keys: readonly string[]): boolean {
  if (!isDescriptorRecord(value) || !hasExactOwnEnumerableKeys(value, ['select'])) {
    return false
  }

  return matchesTrueSelection(value.select, keys)
}

function matchesTrueSelection(value: unknown, keys: readonly string[]): boolean {
  if (!isDescriptorRecord(value) || !hasExactOwnEnumerableKeys(value, keys)) {
    return false
  }

  for (const key of keys) {
    if (value[key] !== true) {
      return false
    }
  }

  return true
}

function singlePlaceholderValues(
  expectedPlaceholders: Record<string, unknown>,
  value: unknown,
): Record<string, unknown> | undefined {
  const keys = Object.keys(expectedPlaceholders)
  if (keys.length !== 1) {
    return keys.length === 0 ? {} : undefined
  }

  return { [keys[0]]: value }
}

function constantPlaceholderValues(expectedPlaceholders: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(expectedPlaceholders)
  if (keys.length === 0) {
    return {}
  }

  const values: Record<string, unknown> = {}
  for (const key of keys) {
    values[key] = expectedPlaceholders[key]
  }
  return values
}

function hasExactOwnEnumerableKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const keys = Object.keys(value)
  if (keys.length !== expectedKeys.length) {
    return false
  }

  let keysMatchInOrder = true
  for (let i = 0; i < expectedKeys.length; i++) {
    if (keys[i] !== expectedKeys[i]) {
      keysMatchInOrder = false
      break
    }
  }
  if (keysMatchInOrder) {
    return true
  }

  for (const key of expectedKeys) {
    if (!Object.hasOwn(value, key)) {
      return false
    }
  }

  return true
}

function buildLazyStaticDescriptor(
  args: Record<string, unknown>,
  cacheKey: string,
  placeholderValues: Record<string, unknown>,
): LazyStaticDescriptor {
  const placeholdersByValue = new Map<string, string>()
  for (const [name, value] of Object.entries(placeholderValues)) {
    const key = lazyDescriptorValueKey(value)
    if (key !== undefined) {
      placeholdersByValue.set(key, name)
    }
  }

  return {
    cacheKey,
    root: buildLazyDescriptorNode(args, placeholdersByValue),
  }
}

function buildLazyDescriptorNode(value: unknown, placeholdersByValue: Map<string, string>): LazyDescriptorNode {
  const valueKey = lazyDescriptorValueKey(value)
  const placeholderName = valueKey === undefined ? undefined : placeholdersByValue.get(valueKey)
  if (placeholderName !== undefined) {
    return {
      kind: 'placeholder',
      name: placeholderName,
      valueType: value === null ? 'null' : typeof value,
    }
  }

  if (Array.isArray(value)) {
    return {
      kind: 'array',
      items: value.map((item) => buildLazyDescriptorNode(item, placeholdersByValue)),
    }
  }

  if (isDescriptorRecord(value)) {
    const keys = Object.keys(value)
    const fields: Record<string, LazyDescriptorNode> = {}
    for (const key of keys) {
      fields[key] = buildLazyDescriptorNode(value[key], placeholdersByValue)
    }
    return {
      kind: 'object',
      keys,
      fields,
    }
  }

  return {
    kind: 'constant',
    value,
  }
}

function tryExtractLazyStaticDescriptor(
  descriptor: LazyStaticDescriptor,
  args: Record<string, unknown>,
): StaticDescriptorExtraction | undefined {
  const placeholderValues: Record<string, unknown> = {}
  if (!matchesLazyDescriptorNode(descriptor.root, args, placeholderValues)) {
    return undefined
  }

  return {
    cacheKey: descriptor.cacheKey,
    placeholderValues,
  }
}

function matchesLazyDescriptorNode(
  descriptor: LazyDescriptorNode,
  value: unknown,
  placeholderValues: Record<string, unknown>,
): boolean {
  switch (descriptor.kind) {
    case 'constant':
      return Object.is(value, descriptor.value)

    case 'placeholder': {
      if ((value === null ? 'null' : typeof value) !== descriptor.valueType) {
        return false
      }

      if (Object.hasOwn(placeholderValues, descriptor.name)) {
        return Object.is(placeholderValues[descriptor.name], value)
      }

      placeholderValues[descriptor.name] = value
      return true
    }

    case 'array':
      if (!Array.isArray(value) || value.length !== descriptor.items.length) {
        return false
      }
      for (let i = 0; i < descriptor.items.length; i++) {
        if (!matchesLazyDescriptorNode(descriptor.items[i], value[i], placeholderValues)) {
          return false
        }
      }
      return true

    case 'object':
      if (!isDescriptorRecord(value) || !hasExactKeys(value, descriptor.keys)) {
        return false
      }
      for (const key of descriptor.keys) {
        if (!matchesLazyDescriptorNode(descriptor.fields[key], value[key], placeholderValues)) {
          return false
        }
      }
      return true
  }
}

function lazyDescriptorValueKey(value: unknown): string | undefined {
  switch (typeof value) {
    case 'string':
      return `string:${value}`
    case 'number':
      return Number.isFinite(value) ? `number:${value}` : undefined
    case 'boolean':
      return `boolean:${value ? 'true' : 'false'}`
    case 'bigint':
      return `bigint:${value}`
    default:
      return undefined
  }
}

function matchesBlogPageTagsSelection(value: unknown): boolean {
  if (!isDescriptorRecord(value) || !hasExactKeys(value, ['select'])) {
    return false
  }

  const select = value.select
  if (!isDescriptorRecord(select) || !hasExactKeys(select, ['tag'])) {
    return false
  }

  return matchesSelectObject(select.tag, BLOG_PAGE_SLUG_SELECT_KEYS)
}

function matchesBlogPageCommentsSelection(value: unknown): boolean {
  if (!isDescriptorRecord(value) || !hasExactKeys(value, ['take', 'orderBy', 'select']) || value.take !== 10) {
    return false
  }

  const orderBy = value.orderBy
  if (!Array.isArray(orderBy) || orderBy.length !== 1) {
    return false
  }

  const firstOrderBy = orderBy[0]
  if (
    !isDescriptorRecord(firstOrderBy) ||
    !hasExactKeys(firstOrderBy, ['createdAt']) ||
    firstOrderBy.createdAt !== 'desc'
  ) {
    return false
  }

  const select = value.select
  if (!isDescriptorRecord(select) || !hasExactKeys(select, BLOG_PAGE_COMMENT_SELECT_KEYS)) {
    return false
  }

  return (
    select.id === true &&
    select.content === true &&
    select.createdAt === true &&
    matchesSelectObject(select.author, BLOG_PAGE_USER_SELECT_KEYS)
  )
}

function matchesSelectObject(value: unknown, keys: readonly string[]): boolean {
  if (!isDescriptorRecord(value) || !hasExactKeys(value, ['select'])) {
    return false
  }

  const select = value.select
  if (!isDescriptorRecord(select) || !hasExactKeys(select, keys)) {
    return false
  }

  for (const key of keys) {
    if (select[key] !== true) {
      return false
    }
  }

  return true
}

function isDescriptorRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const keys = Object.keys(value)
  if (keys.length !== expectedKeys.length) {
    return false
  }

  for (const key of expectedKeys) {
    if (!Object.hasOwn(value, key)) {
      return false
    }
  }

  return true
}

function resetCounts(counts: Counts): void {
  counts.compile = 0
  counts.compileBatch = 0
  counts.queryRaw = 0
  counts.executeRaw = 0
  if (counts.precomputedFastPathHits !== undefined) {
    counts.precomputedFastPathHits = 0
  }
  if (counts.precomputedFastPathLearns !== undefined) {
    counts.precomputedFastPathLearns = 0
  }
  if (counts.precomputedBatchHits !== undefined) {
    counts.precomputedBatchHits = 0
  }
}

function getSingleQueryRequest(query: JsonQuery, queryPart: string): string {
  const actionPart = JSON.stringify(query.action)

  if (query.modelName === undefined) {
    return `{"action":${actionPart},"query":${queryPart}}`
  }

  return `{"modelName":${JSON.stringify(query.modelName)},"action":${actionPart},"query":${queryPart}}`
}

function getStringCacheKeyPart(value: string | null | undefined): string {
  if (value == null) {
    return '-1:'
  }

  return `${value.length}:${value}`
}

function getSingleQueryCacheKey(query: JsonQuery, queryPart: string): string {
  return `s:${getStringCacheKeyPart(query.modelName)}${getStringCacheKeyPart(query.action)}${queryPart.length}:${queryPart}`
}

function checksumCompiledPlan(plan: QueryPlanNode): number {
  return Array.isArray(plan) ? plan.length : Object.keys(plan).length
}

function forceGc(): void {
  for (let i = 0; i < 5; i++) {
    globalThis.gc?.()
  }
}

function heapUsed(): number | undefined {
  if (typeof globalThis.gc !== 'function') {
    return undefined
  }
  forceGc()
  return process.memoryUsage().heapUsed
}

function formatBytes(bytes: number): string {
  const sign = bytes < 0 ? '-' : ''
  const absolute = Math.abs(bytes)

  if (absolute < 1024) {
    return `${bytes} B`
  }

  if (absolute < 1024 * 1024) {
    return `${sign}${(absolute / 1024).toFixed(1)} KiB`
  }

  return `${sign}${(absolute / (1024 * 1024)).toFixed(2)} MiB`
}

function benchmarkIterations(defaultIterations: number): number {
  return ITERATION_OVERRIDE !== undefined && ITERATION_OVERRIDE > 0 ? ITERATION_OVERRIDE : defaultIterations
}

function shouldRunMeasurement(name: string): boolean {
  return MEASUREMENT_FILTER === undefined || name.includes(MEASUREMENT_FILTER)
}

function printMeasurement(measurement: Measurement): void {
  const parts = [
    measurement.name,
    `iterations=${measurement.iterations}`,
    `cacheMaxSize=${measurement.cacheMaxSize}`,
    `elapsed=${measurement.elapsedMs.toFixed(1)} ms`,
    `avg=${measurement.averageUs.toFixed(2)} us/op`,
    `compile=${measurement.counts.compile}`,
    `compileBatch=${measurement.counts.compileBatch}`,
    `queryRaw=${measurement.counts.queryRaw}`,
    `executeRaw=${measurement.counts.executeRaw}`,
  ]

  if (measurement.heapDelta !== undefined) {
    parts.push(`heapDelta=${formatBytes(measurement.heapDelta)}`)
  }

  console.log(parts.join(' | '))
}

function printDirectPlanMeasurement(measurement: DirectPlanMeasurement): void {
  const parts = [
    measurement.name,
    `iterations=${measurement.iterations}`,
    `elapsed=${measurement.elapsedMs.toFixed(1)} ms`,
    `avg=${measurement.averageUs.toFixed(2)} us/op`,
    `queryRaw=${measurement.counts.queryRaw}`,
    `executeRaw=${measurement.counts.executeRaw}`,
  ]

  if (measurement.counts.precomputedFastPathHits !== undefined) {
    parts.push(`precomputedHits=${measurement.counts.precomputedFastPathHits}`)
  }
  if (measurement.counts.precomputedFastPathLearns !== undefined) {
    parts.push(`precomputedLearns=${measurement.counts.precomputedFastPathLearns}`)
  }
  if (measurement.counts.precomputedBatchHits !== undefined) {
    parts.push(`precomputedBatchHits=${measurement.counts.precomputedBatchHits}`)
  }

  if (measurement.heapDelta !== undefined) {
    parts.push(`heapDelta=${formatBytes(measurement.heapDelta)}`)
  }

  console.log(parts.join(' | '))
}

function printCacheKeyMeasurement(measurement: CacheKeyMeasurement): void {
  const parts = [
    measurement.name,
    `iterations=${measurement.iterations}`,
    `elapsed=${measurement.elapsedMs.toFixed(1)} ms`,
    `avg=${measurement.averageUs.toFixed(2)} us/op`,
    `totalKeyBytes=${formatBytes(measurement.totalKeyBytes)}`,
  ]

  if (measurement.heapDelta !== undefined) {
    parts.push(`heapDelta=${formatBytes(measurement.heapDelta)}`)
  }

  console.log(parts.join(' | '))
}

function printPhaseMeasurement(measurement: PhaseMeasurement): void {
  const parts = [
    measurement.name,
    `iterations=${measurement.iterations}`,
    `elapsed=${measurement.elapsedMs.toFixed(1)} ms`,
    `avg=${measurement.averageUs.toFixed(2)} us/op`,
    `checksum=${measurement.checksum}`,
  ]

  if (measurement.heapDelta !== undefined) {
    parts.push(`heapDelta=${formatBytes(measurement.heapDelta)}`)
  }

  console.log(parts.join(' | '))
}

function printPlanPhaseMeasurement(measurement: PlanPhaseMeasurement): void {
  const parts = [
    measurement.name,
    `iterations=${measurement.iterations}`,
    `elapsed=${measurement.elapsedMs.toFixed(1)} ms`,
    `avg=${measurement.averageUs.toFixed(2)} us/op`,
    `checksum=${measurement.checksum}`,
  ]

  if (measurement.heapDelta !== undefined) {
    parts.push(`heapDelta=${formatBytes(measurement.heapDelta)}`)
  }

  console.log(parts.join(' | '))
}

async function measureScenario(config: Omit<EngineConfig, 'adapter' | 'queryPlanCacheMaxSize'>, scenario: Scenario) {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const engine = new ClientEngine(
    {
      ...config,
      adapter: scenario.adapterFactory?.(counts) ?? createAdapterFactory(counts, scenario.resultSet),
      queryPlanCacheMaxSize: scenario.cacheMaxSize,
    },
    await createCountingQueryCompilerLoader(counts),
  )

  try {
    await engine.start()
    resetCounts(counts)

    const queries = new Array<JsonQuery>(scenario.iterations)
    for (let i = 0; i < scenario.iterations; i++) {
      queries[i] = scenario.query(i)
    }

    if (scenario.cacheMaxSize > 0) {
      await engine.request(queries[0], {
        isWrite: false,
      })
      resetCounts(counts)
    }

    const beforeHeap = heapUsed()
    const started = performance.now()
    for (let i = 0; i < scenario.iterations; i++) {
      await engine.request(queries[i], {
        isWrite: false,
      })
    }
    const elapsedMs = performance.now() - started
    const afterHeap = heapUsed()

    return {
      ...scenario,
      elapsedMs,
      averageUs: (elapsedMs * 1000) / scenario.iterations,
      counts: { ...counts },
      heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
    } satisfies Measurement
  } finally {
    await engine.stop()
  }
}

async function measureGeneratedClientScenario(
  config: Omit<EngineConfig, 'adapter' | 'queryPlanCacheMaxSize'>,
  scenario: GeneratedClientScenario,
  precomputedFastPath?: 'engine' | 'request',
  descriptorMatcherRegistry?: DescriptorBoundMatcherRegistry,
): Promise<DirectPlanMeasurement> {
  const usesPrecomputedFastPath = precomputedFastPath !== undefined
  const usesInternalOptions = usesPrecomputedFastPath || descriptorMatcherRegistry !== undefined
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
    precomputedFastPathHits: usesPrecomputedFastPath ? 0 : undefined,
    precomputedFastPathLearns: usesPrecomputedFastPath ? 0 : undefined,
    precomputedBatchHits: usesPrecomputedFastPath ? 0 : undefined,
  }
  const PrismaClient = getPrismaClient({
    runtimeDataModel: config.runtimeDataModel,
    previewFeatures: [],
    clientVersion: config.clientVersion,
    engineVersion: '0000000000000000000000000000000000000000',
    activeProvider: 'sqlite',
    inlineSchema: BENCHMARK_DATAMODEL,
    compilerWasm: getQueryCompilerWasmConfig('sqlite'),
    parameterizationSchema: config.parameterizationSchema,
  })
  const client = new PrismaClient({
    adapter: scenario.adapterFactory?.(counts) ?? createAdapterFactory(counts, scenario.resultSet),
    errorFormat: 'minimal',
    queryPlanCacheMaxSize: 100,
    __internal: usesInternalOptions
      ? {
          enginePrecomputedFastPath: precomputedFastPath === 'engine',
          requestPrecomputedFastPath: precomputedFastPath === 'request',
          configOverride:
            descriptorMatcherRegistry === undefined
              ? undefined
              : (config) => ({
                  ...config,
                  descriptorMatcherRegistry,
                }),
        }
      : undefined,
  }) as any

  if (usesPrecomputedFastPath) {
    const request = client._engine.request.bind(client._engine)
    client._engine.request = (query: JsonQuery, options: Record<string, unknown>) => {
      if (options.precomputedQueryPlanCacheHit !== undefined) {
        counts.precomputedFastPathHits!++
      }
      return request(query, options)
    }

    const requestWithPrecomputedQueryPlanCacheHit = client._engine.requestWithPrecomputedQueryPlanCacheHit.bind(
      client._engine,
    )
    client._engine.requestWithPrecomputedQueryPlanCacheHit = (query: JsonQuery, options: Record<string, unknown>) => {
      counts.precomputedFastPathLearns!++
      return requestWithPrecomputedQueryPlanCacheHit(query, options)
    }

    if (typeof client._engine.requestPrecomputedCachedResult === 'function') {
      const requestPrecomputedCachedResult = client._engine.requestPrecomputedCachedResult.bind(client._engine)
      client._engine.requestPrecomputedCachedResult = (
        query: JsonQuery,
        precomputedQueryPlanCacheHit: unknown,
        options: Record<string, unknown>,
      ) => {
        counts.precomputedFastPathHits!++
        return requestPrecomputedCachedResult(query, precomputedQueryPlanCacheHit, options)
      }
    }

    const requestBatch = client._engine.requestBatch.bind(client._engine)
    client._engine.requestBatch = (queries: JsonQuery[], options: Record<string, unknown>) => {
      const hits = options.precomputedQueryPlanCacheHits
      if (Array.isArray(hits)) {
        counts.precomputedBatchHits! += hits.length
      }
      return requestBatch(queries, options)
    }
  }

  try {
    await client.$connect()
    await scenario.operation(client, 0)
    resetCounts(counts)

    let checksum = 0
    const beforeHeap = heapUsed()
    const started = performance.now()
    for (let i = 0; i < scenario.iterations; i++) {
      const result = await scenario.operation(client, i)
      checksum += scenario.adapterFactory === undefined ? (result === null ? 0 : 1) : checksumNestedBlogResult(result)
    }
    const elapsedMs = performance.now() - started
    const afterHeap = heapUsed()

    if (checksum < 0) {
      throw new Error('unreachable')
    }

    return {
      ...scenario,
      elapsedMs,
      averageUs: (elapsedMs * 1000) / scenario.iterations,
      counts: { ...counts },
      heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
    }
  } finally {
    await client.$disconnect()
  }
}

async function measureGeneratedClientPromiseConstructionScenario(
  config: Omit<EngineConfig, 'adapter' | 'queryPlanCacheMaxSize'>,
  scenario: GeneratedClientScenario,
): Promise<DirectPlanMeasurement> {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const PrismaClient = getPrismaClient({
    runtimeDataModel: config.runtimeDataModel,
    previewFeatures: [],
    clientVersion: config.clientVersion,
    engineVersion: '0000000000000000000000000000000000000000',
    activeProvider: 'sqlite',
    inlineSchema: BENCHMARK_DATAMODEL,
    compilerWasm: getQueryCompilerWasmConfig('sqlite'),
    parameterizationSchema: config.parameterizationSchema,
  })
  const client = new PrismaClient({
    adapter: scenario.adapterFactory?.(counts) ?? createAdapterFactory(counts, scenario.resultSet),
    errorFormat: 'minimal',
    queryPlanCacheMaxSize: 100,
  }) as any

  try {
    await client.$connect()
    void scenario.operation(client, 0)
    resetCounts(counts)

    let checksum = 0
    const beforeHeap = heapUsed()
    const started = performance.now()
    for (let i = 0; i < scenario.iterations; i++) {
      const promise = scenario.operation(client, i)
      checksum += promise === undefined ? 0 : 1
    }
    const elapsedMs = performance.now() - started
    const afterHeap = heapUsed()

    if (checksum < 0) {
      throw new Error('unreachable')
    }

    return {
      ...scenario,
      elapsedMs,
      averageUs: (elapsedMs * 1000) / scenario.iterations,
      counts: { ...counts },
      heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
    }
  } finally {
    await client.$disconnect()
  }
}

function measureGeneratedClientSerializeScenario(
  config: Omit<EngineConfig, 'adapter' | 'queryPlanCacheMaxSize'>,
  scenario: GeneratedClientSerializeScenario,
): PlanPhaseMeasurement {
  serializeJsonQuery({
    modelName: scenario.modelName,
    runtimeDataModel: config.runtimeDataModel,
    action: scenario.action,
    args: scenario.args(0),
    clientMethod: scenario.clientMethod,
    errorFormat: 'minimal',
    clientVersion: config.clientVersion,
    previewFeatures: [],
  })

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    const message = serializeJsonQuery({
      modelName: scenario.modelName,
      runtimeDataModel: config.runtimeDataModel,
      action: scenario.action,
      args: scenario.args(i),
      clientMethod: scenario.clientMethod,
      errorFormat: 'minimal',
      clientVersion: config.clientVersion,
      previewFeatures: [],
    })
    checksum += message.query.selection === undefined ? 0 : 1
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    name: scenario.name,
    iterations: scenario.iterations,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    checksum,
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  }
}

function measureGeneratedClientSerializeCacheKeyScenario(
  config: Omit<EngineConfig, 'adapter' | 'queryPlanCacheMaxSize'>,
  paramGraph: ParamGraph,
  scenario: GeneratedClientSerializeScenario,
): PlanPhaseMeasurement {
  const firstQuery = serializeJsonQuery({
    modelName: scenario.modelName,
    runtimeDataModel: config.runtimeDataModel,
    action: scenario.action,
    args: scenario.args(0),
    clientMethod: scenario.clientMethod,
    errorFormat: 'minimal',
    clientVersion: config.clientVersion,
    previewFeatures: [],
  })
  const { parameterizedQuery: firstParameterizedQuery } = parameterizeQuery(firstQuery, paramGraph)
  getSingleQueryCacheKey(firstParameterizedQuery, JSON.stringify(firstParameterizedQuery.query))

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    const query = serializeJsonQuery({
      modelName: scenario.modelName,
      runtimeDataModel: config.runtimeDataModel,
      action: scenario.action,
      args: scenario.args(i),
      clientMethod: scenario.clientMethod,
      errorFormat: 'minimal',
      clientVersion: config.clientVersion,
      previewFeatures: [],
    })
    const { parameterizedQuery, placeholderValues } = parameterizeQuery(query, paramGraph)
    const queryPart = JSON.stringify(parameterizedQuery.query)
    checksum += getSingleQueryCacheKey(parameterizedQuery, queryPart).length
    checksum += placeholderValues['%1'] === undefined ? 0 : 1
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    name: scenario.name,
    iterations: scenario.iterations,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    checksum,
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  }
}

function getGeneratedScenarioParameterizedShape(
  config: Omit<EngineConfig, 'adapter' | 'queryPlanCacheMaxSize'>,
  paramGraph: ParamGraph,
  scenario: GeneratedClientSerializeScenario,
) {
  const query = serializeJsonQuery({
    modelName: scenario.modelName,
    runtimeDataModel: config.runtimeDataModel,
    action: scenario.action,
    args: scenario.args(0),
    clientMethod: scenario.clientMethod,
    errorFormat: 'minimal',
    clientVersion: config.clientVersion,
    previewFeatures: [],
  })
  const { parameterizedQuery, placeholderValues } = parameterizeQuery(query, paramGraph)
  const queryPart = JSON.stringify(parameterizedQuery.query)

  return {
    query,
    parameterizedQuery,
    placeholderValues,
    queryPart,
    cacheKey: getSingleQueryCacheKey(parameterizedQuery, queryPart),
  }
}

function measureGeneratedBlogPostPageDescriptorExtractScenario(
  config: Omit<EngineConfig, 'adapter' | 'queryPlanCacheMaxSize'>,
  paramGraph: ParamGraph,
  scenario: GeneratedClientSerializeScenario,
): PlanPhaseMeasurement {
  const { cacheKey } = getGeneratedScenarioParameterizedShape(config, paramGraph, scenario)
  const firstExtraction = tryExtractGeneratedBlogPostPageDescriptor(scenario.args(0), cacheKey)
  if (firstExtraction === undefined) {
    throw new Error('Expected generated blog-page descriptor to match first args')
  }

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    const extraction = tryExtractGeneratedBlogPostPageDescriptor(scenario.args(i), cacheKey)
    if (extraction === undefined) {
      throw new Error('Expected generated blog-page descriptor to match benchmark args')
    }
    checksum += extraction.cacheKey.length
    checksum += extraction.placeholderValues['%1'] === undefined ? 0 : 1
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    name: scenario.name,
    iterations: scenario.iterations,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    checksum,
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  }
}

function measureGeneratedLazyDescriptorExtractScenario(
  config: Omit<EngineConfig, 'adapter' | 'queryPlanCacheMaxSize'>,
  paramGraph: ParamGraph,
  scenario: GeneratedClientSerializeScenario,
): PlanPhaseMeasurement {
  const firstArgs = scenario.args(0)
  const { cacheKey, placeholderValues } = getGeneratedScenarioParameterizedShape(config, paramGraph, scenario)
  const descriptor = buildLazyStaticDescriptor(firstArgs, cacheKey, placeholderValues)
  const firstExtraction = tryExtractLazyStaticDescriptor(descriptor, firstArgs)
  if (firstExtraction === undefined) {
    throw new Error('Expected lazy descriptor to match first args')
  }

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    const extraction = tryExtractLazyStaticDescriptor(descriptor, scenario.args(i))
    if (extraction === undefined) {
      throw new Error('Expected lazy descriptor to match benchmark args')
    }
    checksum += extraction.cacheKey.length
    checksum += extraction.placeholderValues['%1'] === undefined ? 0 : 1
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    name: scenario.name,
    iterations: scenario.iterations,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    checksum,
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  }
}

async function measureInternalRequestPrecomputedLazyDescriptorScenario(
  config: Omit<EngineConfig, 'adapter' | 'queryPlanCacheMaxSize'>,
  paramGraph: ParamGraph,
  scenario: GeneratedClientSerializeScenario,
  protocolQueryMode: 'none' | 'dynamic' | 'static',
): Promise<DirectPlanMeasurement> {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const PrismaClient = getPrismaClient({
    runtimeDataModel: config.runtimeDataModel,
    previewFeatures: [],
    clientVersion: config.clientVersion,
    engineVersion: '0000000000000000000000000000000000000000',
    activeProvider: 'sqlite',
    inlineSchema: BENCHMARK_DATAMODEL,
    compilerWasm: getQueryCompilerWasmConfig('sqlite'),
    parameterizationSchema: config.parameterizationSchema,
  })
  const client = new PrismaClient({
    adapter: scenario.adapterFactory?.(counts) ?? createAdapterFactory(counts, scenario.resultSet),
    errorFormat: 'minimal',
    queryPlanCacheMaxSize: 100,
  }) as any

  const firstArgs = scenario.args(0)
  const { query, cacheKey, placeholderValues } = getGeneratedScenarioParameterizedShape(config, paramGraph, scenario)
  const descriptor = buildLazyStaticDescriptor(firstArgs, cacheKey, placeholderValues)
  const staticProtocolQuery = protocolQueryMode === 'static' ? scenario.query(0) : undefined
  const requestBase = {
    dataPath: [],
    action: scenario.action,
    model: scenario.modelName,
    clientMethod: scenario.clientMethod,
  }
  const protocolQueryForIteration = (iteration: number) =>
    protocolQueryMode === 'none'
      ? undefined
      : protocolQueryMode === 'static'
        ? staticProtocolQuery
        : scenario.query(iteration)

  try {
    await client.$connect()
    await client._request({
      ...requestBase,
      args: firstArgs,
      protocolQuery: protocolQueryForIteration(0),
    })
    resetCounts(counts)

    let checksum = 0
    const beforeHeap = heapUsed()
    const started = performance.now()
    for (let i = 0; i < scenario.iterations; i++) {
      const args = scenario.args(i)
      const extraction = tryExtractLazyStaticDescriptor(descriptor, args)
      if (extraction === undefined) {
        throw new Error('Expected lazy descriptor to match benchmark args')
      }

      const result = await client._request({
        ...requestBase,
        args,
        protocolQuery: protocolQueryForIteration(i),
        precomputedQueryPlanCacheHit: extraction,
      })
      checksum += scenario.adapterFactory === undefined ? (result === null ? 0 : 1) : checksumNestedBlogResult(result)
    }
    const elapsedMs = performance.now() - started
    const afterHeap = heapUsed()

    if (checksum < 0) {
      throw new Error('unreachable')
    }

    return {
      name: scenario.name,
      iterations: scenario.iterations,
      query,
      elapsedMs,
      averageUs: (elapsedMs * 1000) / scenario.iterations,
      counts: { ...counts },
      heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
    } satisfies DirectPlanMeasurement
  } finally {
    await client.$disconnect()
  }
}

async function measurePrecomputedLazyDescriptorRequestSurfaceScenario(
  config: Omit<EngineConfig, 'adapter' | 'queryPlanCacheMaxSize'>,
  paramGraph: ParamGraph,
  scenario: GeneratedClientSerializeScenario,
  surface: 'request-handler' | 'client-engine' | 'client-engine-cached-result' | 'prisma-promise-engine',
): Promise<DirectPlanMeasurement> {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const PrismaClient = getPrismaClient({
    runtimeDataModel: config.runtimeDataModel,
    previewFeatures: [],
    clientVersion: config.clientVersion,
    engineVersion: '0000000000000000000000000000000000000000',
    activeProvider: 'sqlite',
    inlineSchema: BENCHMARK_DATAMODEL,
    compilerWasm: getQueryCompilerWasmConfig('sqlite'),
    parameterizationSchema: config.parameterizationSchema,
  })
  const client = new PrismaClient({
    adapter: scenario.adapterFactory?.(counts) ?? createAdapterFactory(counts, scenario.resultSet),
    errorFormat: 'minimal',
    queryPlanCacheMaxSize: 100,
  }) as any

  const firstArgs = scenario.args(0)
  const { query, cacheKey, placeholderValues } = getGeneratedScenarioParameterizedShape(config, paramGraph, scenario)
  const descriptor = buildLazyStaticDescriptor(firstArgs, cacheKey, placeholderValues)
  const protocolQuery = scenario.query(0)
  const requestBase = {
    protocolQuery,
    modelName: scenario.modelName,
    action: scenario.action,
    dataPath: [],
    clientMethod: scenario.clientMethod,
    extensions: client._extensions,
  }

  try {
    await client.$connect()
    await client._request({
      dataPath: [],
      action: scenario.action,
      model: scenario.modelName,
      clientMethod: scenario.clientMethod,
      args: firstArgs,
      protocolQuery,
    })
    resetCounts(counts)

    let checksum = 0
    const beforeHeap = heapUsed()
    const started = performance.now()
    for (let i = 0; i < scenario.iterations; i++) {
      const args = scenario.args(i)
      const extraction = tryExtractLazyStaticDescriptor(descriptor, args)
      if (extraction === undefined) {
        throw new Error('Expected lazy descriptor to match benchmark args')
      }

      let result
      if (surface === 'request-handler') {
        result = await client._requestHandler.request({
          ...requestBase,
          args,
          precomputedQueryPlanCacheHit: extraction,
        })
      } else if (surface === 'prisma-promise-engine') {
        result = await client._createPrismaPromise(
          () =>
            client._engine
              .request(protocolQuery, {
                isWrite: false,
                precomputedQueryPlanCacheHit: extraction,
              })
              .then((response) => response.data[scenario.action]),
          {
            action: scenario.action,
            args,
            model: scenario.modelName,
          },
        )
      } else if (surface === 'client-engine-cached-result') {
        result = await client._engine.requestPrecomputedCachedResult(protocolQuery, extraction, {
          isWrite: false,
        })
      } else {
        result = (
          await client._engine.request(protocolQuery, {
            isWrite: false,
            precomputedQueryPlanCacheHit: extraction,
          })
        ).data[scenario.action]
      }

      checksum += scenario.adapterFactory === undefined ? (result === null ? 0 : 1) : checksumNestedBlogResult(result)
    }
    const elapsedMs = performance.now() - started
    const afterHeap = heapUsed()

    if (checksum < 0) {
      throw new Error('unreachable')
    }

    return {
      name: scenario.name,
      iterations: scenario.iterations,
      query,
      elapsedMs,
      averageUs: (elapsedMs * 1000) / scenario.iterations,
      counts: { ...counts },
      heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
    } satisfies DirectPlanMeasurement
  } finally {
    await client.$disconnect()
  }
}

function compileDirectPlan(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  query: JsonQuery,
): { plan: QueryPlanNode; placeholderValues: Record<string, unknown> } {
  const { parameterizedQuery, placeholderValues } = parameterizeQuery(query, paramGraph)
  const queryPart = JSON.stringify(parameterizedQuery.query)
  return {
    plan: compiler.compile(getSingleQueryRequest(parameterizedQuery, queryPart)) as QueryPlanNode,
    placeholderValues,
  }
}

function getRootDataMapPlan(plan: QueryPlanNode): DirectDataMapPlan {
  if (plan[0] !== 'd') {
    throw new Error(`Expected compact dataMap plan, got ${plan[0]}`)
  }

  return {
    expr: plan[1],
    structure: plan[2],
    enums: plan[3],
  }
}

function getFirstDbQuery(plan: QueryPlanNode): QueryPlanDbQuery {
  const dbQuery = findFirstDbQuery(plan)
  if (dbQuery === undefined) {
    throw new Error('Expected query plan with a DB query')
  }
  return dbQuery
}

function getDbQueries(plan: QueryPlanNode): QueryPlanDbQuery[] {
  const dbQueries: QueryPlanDbQuery[] = []
  collectDbQueries(plan, dbQueries)
  return dbQueries
}

function collectDbQueriesInCompactJoins(joins: CompactJoinExpression[], dbQueries: QueryPlanDbQuery[]): void {
  for (const join of joins) {
    collectDbQueries(join[0], dbQueries)
  }
}

function collectDbQueriesInRawNestedRead(query: RawNestedReadQuery, dbQueries: QueryPlanDbQuery[]): void {
  dbQueries.push(query[0])
  for (const relation of query[2] ?? []) {
    collectDbQueriesInRawNestedRead(relation[2], dbQueries)
  }
}

function collectDbQueries(plan: QueryPlanNode | undefined, dbQueries: QueryPlanDbQuery[]): void {
  if (plan === undefined) {
    return
  }

  switch (plan[0]) {
    case 'q':
    case 'x':
      dbQueries.push(plan[1])
      return

    case 'd':
    case 'p':
    case 'r':
    case 'R':
    case 't':
    case 'u':
      collectDbQueries(plan[1], dbQueries)
      return

    case 'm':
      collectDbQueries(plan[2], dbQueries)
      return

    case 'j':
      collectDbQueries(plan[1], dbQueries)
      collectDbQueriesInCompactJoins(plan[2] as CompactJoinExpression[], dbQueries)
      return

    case 'n':
      collectDbQueriesInRawNestedRead(plan[1], dbQueries)
      return

    case 'V':
      collectDbQueries(plan[1], dbQueries)
      return

    case '?':
      collectDbQueries(plan[1], dbQueries)
      collectDbQueries(plan[3], dbQueries)
      collectDbQueries(plan[4], dbQueries)
      return

    case '-':
      collectDbQueries(plan[1], dbQueries)
      collectDbQueries(plan[2], dbQueries)
      return

    case 'i':
    case 'M':
      collectDbQueries(plan[1], dbQueries)
      return

    case 's':
    case '+':
    case 'c':
      for (const child of plan[1]) {
        collectDbQueries(child, dbQueries)
      }
      return

    case 'l':
      for (const binding of plan[1] as QueryPlanBinding[]) {
        collectDbQueries(getQueryPlanBindingExpr(binding), dbQueries)
      }
      collectDbQueries(plan[2], dbQueries)
      return

    case 'g':
    case 'e':
    case 'v':
    case '0':
      return

    default:
      throw new Error(`Expected compact query plan with DB queries, got ${plan[0]}`)
  }
}

function findFirstDbQueryInCompactJoins(joins: CompactJoinExpression[]): QueryPlanDbQuery | undefined {
  for (const join of joins) {
    const dbQuery = findFirstDbQuery(join[0])
    if (dbQuery !== undefined) {
      return dbQuery
    }
  }
  return undefined
}

function findFirstDbQueryInRawNestedRead(query: RawNestedReadQuery): QueryPlanDbQuery {
  return query[0]
}

function findFirstDbQuery(plan: QueryPlanNode | undefined): QueryPlanDbQuery | undefined {
  if (plan === undefined) {
    return undefined
  }

  switch (plan[0]) {
    case 'q':
    case 'x':
      return plan[1]

    case 'd':
    case 'p':
    case 'r':
    case 'R':
    case 't':
    case 'u':
      return findFirstDbQuery(plan[1])

    case 'm':
      return findFirstDbQuery(plan[2])

    case 'j':
      return findFirstDbQuery(plan[1]) ?? findFirstDbQueryInCompactJoins(plan[2] as CompactJoinExpression[])

    case 'n':
      return findFirstDbQueryInRawNestedRead(plan[1])

    case 'V':
      return findFirstDbQuery(plan[1])

    case '?':
      return findFirstDbQuery(plan[1]) ?? findFirstDbQuery(plan[3]) ?? findFirstDbQuery(plan[4])

    case '-':
      return findFirstDbQuery(plan[1]) ?? findFirstDbQuery(plan[2])

    case 'i':
    case 'M':
      return findFirstDbQuery(plan[1])

    case 's':
    case '+':
    case 'c':
      for (const child of plan[1]) {
        const dbQuery = findFirstDbQuery(child)
        if (dbQuery !== undefined) {
          return dbQuery
        }
      }
      return undefined

    case 'l':
      for (const binding of plan[1] as QueryPlanBinding[]) {
        const dbQuery = findFirstDbQuery(getQueryPlanBindingExpr(binding))
        if (dbQuery !== undefined) {
          return dbQuery
        }
      }
      return findFirstDbQuery(plan[2])

    case 'g':
    case 'e':
    case 'v':
    case '0':
      return undefined

    default:
      throw new Error(`Expected compact query plan with a DB query, got ${plan[0]}`)
  }
}

function isObjectResultNode(structure: ResultNode): boolean {
  return Array.isArray(structure)
}

function isCompactPlanNode(plan: QueryPlanNode): plan is QueryPlanCompactNode {
  return Array.isArray(plan)
}

function isRawNestedReadPlan(plan: QueryPlanNode): boolean {
  return isCompactPlanNode(plan) && plan[0] === 'n'
}

function scenarioCompilesToRawNestedRead(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: DirectPlanScenario,
): boolean {
  return isRawNestedReadPlan(compileDirectPlan(compiler, paramGraph, scenario.query).plan)
}

function replaceQueryLeavesWithPrecomputedGetters(plan: QueryPlanNode, state: { index: number }): QueryPlanNode {
  if (!isCompactPlanNode(plan)) {
    throw new Error('Expected compact query plan')
  }

  switch (plan[0]) {
    case 'q': {
      return ['g', `precomputedQuery${state.index++}`] as unknown as QueryPlanNode
    }

    case 'x': {
      throw new Error('Unexpected execute node in precomputed-query phase')
    }

    case 'v':
    case 'g':
    case 'e':
    case '0': {
      return plan
    }

    case 's':
    case '+':
    case 'c': {
      return [
        plan[0],
        plan[1].map((child) => replaceQueryLeavesWithPrecomputedGetters(child, state)),
      ] as unknown as QueryPlanNode
    }

    case 'l': {
      return [
        'l',
        plan[1].map(
          (binding) =>
            [
              getQueryPlanBindingName(binding),
              replaceQueryLeavesWithPrecomputedGetters(getQueryPlanBindingExpr(binding), state),
            ] as QueryPlanBinding,
        ),
        replaceQueryLeavesWithPrecomputedGetters(plan[2], state),
      ] as unknown as QueryPlanNode
    }

    case 'j': {
      return [
        'j',
        replaceQueryLeavesWithPrecomputedGetters(plan[1], state),
        (plan[2] as CompactJoinExpression[]).map(
          (join) =>
            [
              replaceQueryLeavesWithPrecomputedGetters(join[0], state),
              join[1],
              join[2],
              join[3],
            ] as CompactJoinExpression,
        ),
        plan[3],
      ] as unknown as QueryPlanNode
    }

    case 'd': {
      return [
        'd',
        replaceQueryLeavesWithPrecomputedGetters(plan[1], state),
        plan[2],
        plan[3],
      ] as unknown as QueryPlanNode
    }

    case '?': {
      return [
        '?',
        replaceQueryLeavesWithPrecomputedGetters(plan[1], state),
        plan[2],
        replaceQueryLeavesWithPrecomputedGetters(plan[3], state),
        replaceQueryLeavesWithPrecomputedGetters(plan[4], state),
      ] as unknown as QueryPlanNode
    }

    case '-': {
      return [
        '-',
        replaceQueryLeavesWithPrecomputedGetters(plan[1], state),
        replaceQueryLeavesWithPrecomputedGetters(plan[2], state),
        plan[3],
      ] as unknown as QueryPlanNode
    }

    case 'V': {
      return [
        'V',
        replaceQueryLeavesWithPrecomputedGetters(plan[1], state),
        plan[2],
        plan[3],
        plan[4],
      ] as unknown as QueryPlanNode
    }

    case 'i':
    case 'M': {
      return [plan[0], replaceQueryLeavesWithPrecomputedGetters(plan[1], state), plan[2]] as unknown as QueryPlanNode
    }

    case 'm': {
      return ['m', plan[1], replaceQueryLeavesWithPrecomputedGetters(plan[2], state)] as unknown as QueryPlanNode
    }

    case 'p': {
      return ['p', replaceQueryLeavesWithPrecomputedGetters(plan[1], state), plan[2]] as unknown as QueryPlanNode
    }

    case 'r':
    case 'R':
    case 't':
    case 'u': {
      return [plan[0], replaceQueryLeavesWithPrecomputedGetters(plan[1], state)] as unknown as QueryPlanNode
    }

    default:
      throw new Error(`Unexpected compact query plan node: ${plan[0]}`)
  }
}

function replaceQueryAndJoinLeavesWithPrecomputedGetters(
  plan: QueryPlanNode,
  state: { queryIndex: number; joinIndex: number },
): QueryPlanNode {
  if (!isCompactPlanNode(plan)) {
    throw new Error('Expected compact query plan')
  }

  switch (plan[0]) {
    case 'q': {
      return ['g', `precomputedQuery${state.queryIndex++}`] as unknown as QueryPlanNode
    }

    case 'j': {
      return ['g', `precomputedJoin${state.joinIndex++}`] as unknown as QueryPlanNode
    }

    case 'x': {
      throw new Error('Unexpected execute node in precomputed-join phase')
    }

    case 'v':
    case 'g':
    case 'e':
    case '0': {
      return plan
    }

    case 's':
    case '+':
    case 'c': {
      return [
        plan[0],
        plan[1].map((child) => replaceQueryAndJoinLeavesWithPrecomputedGetters(child, state)),
      ] as unknown as QueryPlanNode
    }

    case 'l': {
      return [
        'l',
        plan[1].map(
          (binding) =>
            [
              getQueryPlanBindingName(binding),
              replaceQueryAndJoinLeavesWithPrecomputedGetters(getQueryPlanBindingExpr(binding), state),
            ] as QueryPlanBinding,
        ),
        replaceQueryAndJoinLeavesWithPrecomputedGetters(plan[2], state),
      ] as unknown as QueryPlanNode
    }

    case 'd': {
      return [
        'd',
        replaceQueryAndJoinLeavesWithPrecomputedGetters(plan[1], state),
        plan[2],
        plan[3],
      ] as unknown as QueryPlanNode
    }

    case '?': {
      return [
        '?',
        replaceQueryAndJoinLeavesWithPrecomputedGetters(plan[1], state),
        plan[2],
        replaceQueryAndJoinLeavesWithPrecomputedGetters(plan[3], state),
        replaceQueryAndJoinLeavesWithPrecomputedGetters(plan[4], state),
      ] as unknown as QueryPlanNode
    }

    case '-': {
      return [
        '-',
        replaceQueryAndJoinLeavesWithPrecomputedGetters(plan[1], state),
        replaceQueryAndJoinLeavesWithPrecomputedGetters(plan[2], state),
        plan[3],
      ] as unknown as QueryPlanNode
    }

    case 'V': {
      return [
        'V',
        replaceQueryAndJoinLeavesWithPrecomputedGetters(plan[1], state),
        plan[2],
        plan[3],
        plan[4],
      ] as unknown as QueryPlanNode
    }

    case 'i':
    case 'M': {
      return [
        plan[0],
        replaceQueryAndJoinLeavesWithPrecomputedGetters(plan[1], state),
        plan[2],
      ] as unknown as QueryPlanNode
    }

    case 'm': {
      return ['m', plan[1], replaceQueryAndJoinLeavesWithPrecomputedGetters(plan[2], state)] as unknown as QueryPlanNode
    }

    case 'p': {
      return ['p', replaceQueryAndJoinLeavesWithPrecomputedGetters(plan[1], state), plan[2]] as unknown as QueryPlanNode
    }

    case 'r':
    case 'R':
    case 't':
    case 'u': {
      return [plan[0], replaceQueryAndJoinLeavesWithPrecomputedGetters(plan[1], state)] as unknown as QueryPlanNode
    }

    default:
      throw new Error(`Unexpected compact query plan node: ${plan[0]}`)
  }
}

function replaceRootJoinChildrenWithPrecomputedGetters(
  plan: QueryPlanNode,
  state: { queryIndex: number; childIndex: number; foundJoin: boolean },
): QueryPlanNode {
  if (!isCompactPlanNode(plan)) {
    throw new Error('Expected compact query plan')
  }

  switch (plan[0]) {
    case 'q': {
      return ['g', `precomputedQuery${state.queryIndex++}`] as unknown as QueryPlanNode
    }

    case 'j': {
      if (state.foundJoin) {
        return plan
      }

      state.foundJoin = true
      return [
        'j',
        replaceRootJoinChildrenWithPrecomputedGetters(plan[1], state),
        (plan[2] as CompactJoinExpression[]).map(
          (join) =>
            [
              ['g', `precomputedRootJoinChild${state.childIndex++}`],
              join[1],
              join[2],
              join[3],
            ] as CompactJoinExpression,
        ),
        plan[3],
      ] as unknown as QueryPlanNode
    }

    case 'x': {
      throw new Error('Unexpected execute node in precomputed-root-join-child phase')
    }

    case 'v':
    case 'g':
    case 'e':
    case '0': {
      return plan
    }

    case 's':
    case '+':
    case 'c': {
      return [
        plan[0],
        plan[1].map((child) => replaceRootJoinChildrenWithPrecomputedGetters(child, state)),
      ] as unknown as QueryPlanNode
    }

    case 'l': {
      return [
        'l',
        plan[1].map(
          (binding) =>
            [
              getQueryPlanBindingName(binding),
              replaceRootJoinChildrenWithPrecomputedGetters(getQueryPlanBindingExpr(binding), state),
            ] as QueryPlanBinding,
        ),
        replaceRootJoinChildrenWithPrecomputedGetters(plan[2], state),
      ] as unknown as QueryPlanNode
    }

    case 'd': {
      return [
        'd',
        replaceRootJoinChildrenWithPrecomputedGetters(plan[1], state),
        plan[2],
        plan[3],
      ] as unknown as QueryPlanNode
    }

    case '?': {
      return [
        '?',
        replaceRootJoinChildrenWithPrecomputedGetters(plan[1], state),
        plan[2],
        replaceRootJoinChildrenWithPrecomputedGetters(plan[3], state),
        replaceRootJoinChildrenWithPrecomputedGetters(plan[4], state),
      ] as unknown as QueryPlanNode
    }

    case '-': {
      return [
        '-',
        replaceRootJoinChildrenWithPrecomputedGetters(plan[1], state),
        replaceRootJoinChildrenWithPrecomputedGetters(plan[2], state),
        plan[3],
      ] as unknown as QueryPlanNode
    }

    case 'V': {
      return [
        'V',
        replaceRootJoinChildrenWithPrecomputedGetters(plan[1], state),
        plan[2],
        plan[3],
        plan[4],
      ] as unknown as QueryPlanNode
    }

    case 'i':
    case 'M': {
      return [
        plan[0],
        replaceRootJoinChildrenWithPrecomputedGetters(plan[1], state),
        plan[2],
      ] as unknown as QueryPlanNode
    }

    case 'm': {
      return ['m', plan[1], replaceRootJoinChildrenWithPrecomputedGetters(plan[2], state)] as unknown as QueryPlanNode
    }

    case 'p': {
      return ['p', replaceRootJoinChildrenWithPrecomputedGetters(plan[1], state), plan[2]] as unknown as QueryPlanNode
    }

    case 'r':
    case 'R':
    case 't':
    case 'u': {
      return [plan[0], replaceRootJoinChildrenWithPrecomputedGetters(plan[1], state)] as unknown as QueryPlanNode
    }

    default:
      throw new Error(`Unexpected compact query plan node: ${plan[0]}`)
  }
}

function getRootCompactJoin(plan: QueryPlanNode): QueryPlanCompactNode {
  if (!isCompactPlanNode(plan)) {
    throw new Error('Expected compact query plan')
  }

  switch (plan[0]) {
    case 'j': {
      return plan
    }

    case 'l': {
      return getRootCompactJoin(plan[2])
    }

    case 'd':
    case 'p':
    case 'r':
    case 'R':
    case 't':
    case 'u':
    case 'V': {
      return getRootCompactJoin(plan[1])
    }

    case 'm': {
      return getRootCompactJoin(plan[2])
    }

    default:
      throw new Error(`Expected compact query plan with a root join, got ${plan[0]}`)
  }
}

function wrapWithCompactLetBindings(plan: QueryPlanNode, bindingGroups: QueryPlanBinding[][]): QueryPlanNode {
  let wrapped = plan
  for (let i = bindingGroups.length - 1; i >= 0; i--) {
    wrapped = ['l', bindingGroups[i], wrapped] as unknown as QueryPlanNode
  }
  return wrapped
}

function getRootCompactJoinChildPlans(plan: QueryPlanNode, bindingGroups: QueryPlanBinding[][] = []): QueryPlanNode[] {
  if (!isCompactPlanNode(plan)) {
    throw new Error('Expected compact query plan')
  }

  switch (plan[0]) {
    case 'j': {
      return (plan[2] as CompactJoinExpression[]).map((join) => wrapWithCompactLetBindings(join[0], bindingGroups))
    }

    case 'l': {
      return getRootCompactJoinChildPlans(plan[2], [...bindingGroups, plan[1] as QueryPlanBinding[]])
    }

    case 'd':
    case 'p':
    case 'r':
    case 'R':
    case 't':
    case 'u':
    case 'V': {
      return getRootCompactJoinChildPlans(plan[1], bindingGroups)
    }

    case 'm': {
      return getRootCompactJoinChildPlans(plan[2], bindingGroups)
    }

    default:
      throw new Error(`Expected compact query plan with root join children, got ${plan[0]}`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

function numericField(value: Record<string, unknown>, field: string): number {
  const fieldValue = value[field]
  return typeof fieldValue === 'number' ? fieldValue : 0
}

function checksumNestedBlogInnerValue(value: unknown): number {
  if (!isRecord(value)) {
    return 0
  }

  return (
    numericField(value, 'id') +
    arrayLength(value['@nested$tags']) +
    arrayLength(value['@nested$comments']) +
    (isRecord(value['@nested$author']) ? 1 : 0) +
    (isRecord(value['@nested$category']) ? 1 : 0)
  )
}

function checksumNestedBlogResult(value: unknown): number {
  if (!isRecord(value)) {
    return 0
  }

  return numericField(value, 'id') + arrayLength(value.tags) + arrayLength(value.comments)
}

function checksumNestedBlogExactResult(value: unknown): number {
  const base = checksumNestedBlogResult(value)
  if (!isRecord(value) || !Array.isArray(value.tags)) {
    return base
  }

  let checksum = base
  for (let i = 0; i < value.tags.length; i++) {
    const wrapper = value.tags[i]
    if (isRecord(wrapper) && isRecord(wrapper.tag)) {
      checksum += numericField(wrapper.tag, 'id')
    }
  }
  return checksum
}

async function measureDirectPlanScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: DirectPlanScenario,
) {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const interpreter = QueryInterpreter.forSql({
    tracingHelper: noopTracingHelper,
    provider: 'sqlite',
    connectionInfo: {
      supportsRelationJoins: false,
    },
    resultFormat: 'js',
  })
  const adapter = await createScenarioAdapter(counts, scenario)
  const { plan, placeholderValues } = compileDirectPlan(compiler, paramGraph, scenario.query)

  await interpreter.run(plan, {
    queryable: adapter,
    scope: placeholderValues,
    transactionManager: { enabled: false },
  })
  resetCounts(counts)

  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    await interpreter.run(plan, {
      queryable: adapter,
      scope: placeholderValues,
      transactionManager: { enabled: false },
    })
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    ...scenario,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    counts: { ...counts },
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  } satisfies DirectPlanMeasurement
}

function measureCacheKeyScenario(paramGraph: ParamGraph, scenario: CacheKeyScenario) {
  const queries = new Array<JsonQuery>(scenario.iterations)
  for (let i = 0; i < scenario.iterations; i++) {
    queries[i] = scenario.query(i)
  }

  for (let i = 0; i < scenario.iterations; i++) {
    const { parameterizedQuery } = parameterizeQuery(queries[i], paramGraph)
    const queryPart = JSON.stringify(parameterizedQuery.query)
    getSingleQueryCacheKey(parameterizedQuery, queryPart)
  }

  let totalKeyBytes = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    const { parameterizedQuery } = parameterizeQuery(queries[i], paramGraph)
    const queryPart = JSON.stringify(parameterizedQuery.query)
    totalKeyBytes += getSingleQueryCacheKey(parameterizedQuery, queryPart).length
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    ...scenario,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    totalKeyBytes,
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  } satisfies CacheKeyMeasurement
}

function measureRequestAsCacheKeyScenario(paramGraph: ParamGraph, scenario: CacheKeyScenario) {
  const queries = new Array<JsonQuery>(scenario.iterations)
  for (let i = 0; i < scenario.iterations; i++) {
    queries[i] = scenario.query(i)
  }

  for (let i = 0; i < scenario.iterations; i++) {
    const { parameterizedQuery } = parameterizeQuery(queries[i], paramGraph)
    const queryPart = JSON.stringify(parameterizedQuery.query)
    getSingleQueryRequest(parameterizedQuery, queryPart)
  }

  let totalKeyBytes = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    const { parameterizedQuery } = parameterizeQuery(queries[i], paramGraph)
    const queryPart = JSON.stringify(parameterizedQuery.query)
    totalKeyBytes += getSingleQueryRequest(parameterizedQuery, queryPart).length
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    ...scenario,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    totalKeyBytes,
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  } satisfies CacheKeyMeasurement
}

function measureParameterizeScenario(paramGraph: ParamGraph, scenario: CacheKeyScenario) {
  const queries = new Array<JsonQuery>(scenario.iterations)
  for (let i = 0; i < scenario.iterations; i++) {
    queries[i] = scenario.query(i)
  }

  for (let i = 0; i < scenario.iterations; i++) {
    parameterizeQuery(queries[i], paramGraph)
  }

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    const { parameterizedQuery, placeholderValues } = parameterizeQuery(queries[i], paramGraph)
    checksum += parameterizedQuery.query === queries[i].query ? 0 : 1
    checksum += placeholderValues['%1'] === undefined ? 0 : 1
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    ...scenario,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    checksum,
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  } satisfies PhaseMeasurement
}

function measureStringifyCacheKeyScenario(paramGraph: ParamGraph, scenario: CacheKeyScenario) {
  const parameterizedQueries = new Array<JsonQuery>(scenario.iterations)
  for (let i = 0; i < scenario.iterations; i++) {
    parameterizedQueries[i] = parameterizeQuery(scenario.query(i), paramGraph).parameterizedQuery
  }

  for (let i = 0; i < scenario.iterations; i++) {
    const queryPart = JSON.stringify(parameterizedQueries[i].query)
    getSingleQueryCacheKey(parameterizedQueries[i], queryPart)
  }

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    const queryPart = JSON.stringify(parameterizedQueries[i].query)
    checksum += getSingleQueryCacheKey(parameterizedQueries[i], queryPart).length
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    ...scenario,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    checksum,
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  } satisfies PhaseMeasurement
}

function measureCompilePrebuiltRequestScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: CacheKeyScenario,
) {
  const requests = new Array<string>(scenario.iterations)
  for (let i = 0; i < scenario.iterations; i++) {
    const { parameterizedQuery } = parameterizeQuery(scenario.query(i), paramGraph)
    const queryPart = JSON.stringify(parameterizedQuery.query)
    requests[i] = getSingleQueryRequest(parameterizedQuery, queryPart)
  }

  for (let i = 0; i < scenario.iterations; i++) {
    compiler.compile(requests[i])
  }

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    checksum += checksumCompiledPlan(compiler.compile(requests[i]) as QueryPlanNode)
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    ...scenario,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    checksum,
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  } satisfies PhaseMeasurement
}

function measureCompileCurrentMissScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: CacheKeyScenario,
) {
  const queries = new Array<JsonQuery>(scenario.iterations)
  for (let i = 0; i < scenario.iterations; i++) {
    queries[i] = scenario.query(i)
  }

  for (let i = 0; i < scenario.iterations; i++) {
    const { parameterizedQuery } = parameterizeQuery(queries[i], paramGraph)
    const queryPart = JSON.stringify(parameterizedQuery.query)
    compiler.compile(getSingleQueryRequest(parameterizedQuery, queryPart))
  }

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    const { parameterizedQuery } = parameterizeQuery(queries[i], paramGraph)
    const queryPart = JSON.stringify(parameterizedQuery.query)
    checksum += checksumCompiledPlan(
      compiler.compile(getSingleQueryRequest(parameterizedQuery, queryPart)) as QueryPlanNode,
    )
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    ...scenario,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    checksum,
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  } satisfies PhaseMeasurement
}

async function measureDirectPlanScopeScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: DirectPlanScopeScenario,
) {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const interpreter = QueryInterpreter.forSql({
    tracingHelper: noopTracingHelper,
    provider: 'sqlite',
    connectionInfo: {
      supportsRelationJoins: false,
    },
    resultFormat: 'js',
  })
  const adapter = await createScenarioAdapter(counts, scenario)
  const firstQuery = scenario.query(0)
  const { plan } = compileDirectPlan(compiler, paramGraph, firstQuery)
  const placeholderValues = new Array<Record<string, unknown>>(scenario.iterations)
  for (let i = 0; i < scenario.iterations; i++) {
    placeholderValues[i] = parameterizeQuery(scenario.query(i), paramGraph).placeholderValues
  }

  await interpreter.run(plan, {
    queryable: adapter,
    scope: placeholderValues[0],
    transactionManager: { enabled: false },
  })
  resetCounts(counts)

  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    await interpreter.run(plan, {
      queryable: adapter,
      scope: placeholderValues[i],
      transactionManager: { enabled: false },
    })
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    ...scenario,
    query: firstQuery,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    counts: { ...counts },
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  } satisfies DirectPlanMeasurement
}

function measureRenderQueryScopeScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: DirectPlanScopeScenario,
): PlanPhaseMeasurement {
  const firstQuery = scenario.query(0)
  const { plan } = compileDirectPlan(compiler, paramGraph, firstQuery)
  const dbQuery = getFirstDbQuery(plan)
  const placeholderValues = new Array<Record<string, unknown>>(scenario.iterations)
  for (let i = 0; i < scenario.iterations; i++) {
    placeholderValues[i] = parameterizeQuery(scenario.query(i), paramGraph).placeholderValues
  }

  const generators = Object.create(null) as GeneratorRegistrySnapshot
  for (let i = 0; i < scenario.iterations; i++) {
    renderQuery(dbQuery, placeholderValues[i], generators, 999)
  }

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    const queries = renderQuery(dbQuery, placeholderValues[i], generators, 999)
    for (let queryIndex = 0; queryIndex < queries.length; queryIndex++) {
      checksum += queries[queryIndex].sql.length + queries[queryIndex].args.length
    }
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    name: scenario.name,
    iterations: scenario.iterations,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    checksum,
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  }
}

function getBlogPageRenderScopes(): Record<string, unknown>[] {
  return [
    { '%1': 1 },
    { '@parent$authorId': 10 },
    { '@parent$categoryId': 20 },
    { '@parent$id': 1 },
    { '@parent$tagId': [100, 101] },
    { '@parent$id': 1 },
    { '@parent$authorId': [11, 12] },
  ]
}

function measureRenderBlogPageQueriesScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: DirectPlanScenario,
): PlanPhaseMeasurement {
  const { plan } = compileDirectPlan(compiler, paramGraph, scenario.query)
  const dbQueries = getDbQueries(plan)
  const scopes = getBlogPageRenderScopes()
  if (dbQueries.length !== scopes.length) {
    throw new Error(`Expected ${scopes.length} blog-page DB queries, got ${dbQueries.length}`)
  }

  const generators = Object.create(null) as GeneratorRegistrySnapshot
  for (let i = 0; i < scenario.iterations; i++) {
    for (let queryIndex = 0; queryIndex < dbQueries.length; queryIndex++) {
      renderQuery(dbQueries[queryIndex], scopes[queryIndex], generators, 999)
    }
  }

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    for (let queryIndex = 0; queryIndex < dbQueries.length; queryIndex++) {
      const renderedQueries = renderQuery(dbQueries[queryIndex], scopes[queryIndex], generators, 999)
      for (let renderedIndex = 0; renderedIndex < renderedQueries.length; renderedIndex++) {
        const renderedQuery = renderedQueries[renderedIndex]
        checksum += renderedQuery.sql.length + renderedQuery.args.length + renderedQuery.argTypes.length
      }
    }
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    name: scenario.name,
    iterations: scenario.iterations,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    checksum,
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  }
}

function measureDataMapScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: DirectPlanScenario,
): PlanPhaseMeasurement {
  const { plan } = compileDirectPlan(compiler, paramGraph, scenario.query)
  const { structure, enums } = getRootDataMapPlan(plan)
  if (!isObjectResultNode(structure)) {
    throw new Error('Expected object result mapping')
  }

  const resultSet = scenario.resultSet ?? EMPTY_RESULT
  for (let i = 0; i < scenario.iterations; i++) {
    applyDataMapToResultSet(resultSet, structure as never, enums, 'js')
  }

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    checksum += applyDataMapToResultSet(resultSet, structure as never, enums, 'js').length
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    name: scenario.name,
    iterations: scenario.iterations,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    checksum,
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  }
}

function checksumSerializedRows(rows: Record<string, unknown>[]): number {
  let checksum = rows.length
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const id = row.id
    if (typeof id === 'number') {
      checksum += id
    }

    const postId = row.postId
    if (typeof postId === 'number') {
      checksum += postId
    }

    const name = row.name
    if (typeof name === 'string') {
      checksum += name.length
    }
  }
  return checksum
}

function measureBlogPageSerializeSqlScenario(iterations: number): PlanPhaseMeasurement {
  for (let i = 0; i < iterations; i++) {
    for (let resultSetIndex = 0; resultSetIndex < BLOG_PAGE_RESULT_SETS.length; resultSetIndex++) {
      serializeSql(BLOG_PAGE_RESULT_SETS[resultSetIndex])
    }
  }

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < iterations; i++) {
    for (let resultSetIndex = 0; resultSetIndex < BLOG_PAGE_RESULT_SETS.length; resultSetIndex++) {
      checksum += checksumSerializedRows(serializeSql(BLOG_PAGE_RESULT_SETS[resultSetIndex]))
    }
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    name: 'serializeSql blog page result sets / nested rows',
    iterations,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / iterations,
    checksum,
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  }
}

async function measureBlogPageAdapterOnlyScenario(iterations: number): Promise<PlanPhaseMeasurement> {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const adapter = new BlogPageSqliteAdapter(counts)

  for (let i = 0; i < iterations; i++) {
    for (let queryIndex = 0; queryIndex < BLOG_PAGE_QUERY_SELECTORS.length; queryIndex++) {
      await adapter.queryRaw(BLOG_PAGE_QUERY_SELECTORS[queryIndex])
    }
  }
  resetCounts(counts)

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < iterations; i++) {
    for (let queryIndex = 0; queryIndex < BLOG_PAGE_QUERY_SELECTORS.length; queryIndex++) {
      const resultSet = await adapter.queryRaw(BLOG_PAGE_QUERY_SELECTORS[queryIndex])
      checksum += resultSet.rows.length + resultSet.columnNames.length
    }
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    name: 'adapter queryRaw blog page result sets / nested rows',
    iterations,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / iterations,
    checksum: checksum + counts.queryRaw,
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  }
}

function assembleBlogPageFromRawResultSets(): Record<string, unknown> | null {
  const postRow = BLOG_PAGE_POST_RESULT.rows[0]
  if (postRow === undefined) {
    return null
  }

  const postId = postRow[0]
  const tagRows = BLOG_PAGE_TAG_RESULT.rows
  const postTagRows = BLOG_PAGE_POST_TAG_RESULT.rows
  const commentRows = BLOG_PAGE_COMMENT_RESULT.rows
  const commentAuthorRows = BLOG_PAGE_COMMENT_AUTHOR_RESULT.rows

  const result = {
    id: postRow[0],
    title: postRow[1],
    slug: postRow[2],
    content: postRow[3],
    published: postRow[4],
    viewCount: postRow[5],
    createdAt: postRow[6],
    author: mapUserRow(BLOG_PAGE_AUTHOR_RESULT.rows[0]),
    category: mapCategoryRow(BLOG_PAGE_CATEGORY_RESULT.rows[0]),
    tags: [] as Record<string, unknown>[],
    comments: [] as Record<string, unknown>[],
    _count: {
      likes: postRow[9],
      comments: postRow[10],
    },
  }

  for (let i = 0; i < postTagRows.length; i++) {
    const postTagRow = postTagRows[i]
    if (postTagRow[0] !== postId) {
      continue
    }

    const tagId = postTagRow[1]
    for (let tagIndex = 0; tagIndex < tagRows.length; tagIndex++) {
      const tagRow = tagRows[tagIndex]
      if (tagRow[0] === tagId) {
        result.tags.push(mapTagRow(tagRow))
        break
      }
    }
  }

  for (let i = 0; i < commentRows.length; i++) {
    const commentRow = commentRows[i]
    if (commentRow[4] !== postId) {
      continue
    }

    let author: Record<string, unknown> | null = null
    const authorId = commentRow[3]
    for (let authorIndex = 0; authorIndex < commentAuthorRows.length; authorIndex++) {
      const authorRow = commentAuthorRows[authorIndex]
      if (authorRow[0] === authorId) {
        author = mapUserRow(authorRow)
        break
      }
    }

    result.comments.push({
      id: commentRow[0],
      content: commentRow[1],
      createdAt: commentRow[2],
      author,
    })
  }

  return result
}

function mapUserRow(row: unknown[] | undefined): Record<string, unknown> | null {
  if (row === undefined) {
    return null
  }

  return {
    id: row[0],
    name: row[1],
    avatar: row[2],
  }
}

function mapCategoryRow(row: unknown[] | undefined): Record<string, unknown> | null {
  if (row === undefined) {
    return null
  }

  return {
    id: row[0],
    name: row[1],
    slug: row[2],
  }
}

function mapTagRow(row: unknown[]): Record<string, unknown> {
  return {
    id: row[0],
    name: row[1],
    slug: row[2],
  }
}

function measureRawResultSetBlogPageAssemblyScenario(iterations: number): PlanPhaseMeasurement {
  for (let i = 0; i < iterations; i++) {
    assembleBlogPageFromRawResultSets()
  }

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < iterations; i++) {
    checksum += checksumNestedBlogResult(assembleBlogPageFromRawResultSets())
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    name: 'raw result-set blog page assembly / nested rows',
    iterations,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / iterations,
    checksum,
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  }
}

type RawColumnMapping = readonly [fieldName: string, columnIndex: number, fieldType: FieldType]

const RAW_POST_COLUMNS: readonly RawColumnMapping[] = Object.freeze([
  ['id', 0, 'i'],
  ['title', 1, 's'],
  ['slug', 2, 's'],
  ['content', 3, 's'],
  ['published', 4, 'b'],
  ['viewCount', 5, 'i'],
  ['createdAt', 6, 'D'],
])
const RAW_USER_COLUMNS: readonly RawColumnMapping[] = Object.freeze([
  ['id', 0, 'i'],
  ['name', 1, 's'],
  ['avatar', 2, 's'],
])
const RAW_CATEGORY_COLUMNS: readonly RawColumnMapping[] = Object.freeze([
  ['id', 0, 'i'],
  ['name', 1, 's'],
  ['slug', 2, 's'],
])
const RAW_TAG_COLUMNS: readonly RawColumnMapping[] = Object.freeze([
  ['id', 0, 'i'],
  ['name', 1, 's'],
  ['slug', 2, 's'],
])
const RAW_COMMENT_COLUMNS: readonly RawColumnMapping[] = Object.freeze([
  ['id', 0, 'i'],
  ['content', 1, 's'],
  ['createdAt', 2, 'D'],
])

function mapRawRows(rows: readonly unknown[][], mappings: readonly RawColumnMapping[]): Record<string, unknown>[] {
  const result = new Array<Record<string, unknown>>(rows.length)
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    result[rowIndex] = mapRawRow(rows[rowIndex], mappings)
  }
  return result
}

function mapRawRow(row: readonly unknown[], mappings: readonly RawColumnMapping[]): Record<string, unknown> {
  const result = {}
  for (let i = 0; i < mappings.length; i++) {
    const [fieldName, columnIndex] = mappings[i]
    result[fieldName] = row[columnIndex]
  }
  return result
}

function uniqueColumnValues(rows: readonly unknown[][], columnIndex: number): unknown[] {
  if (rows.length === 0) {
    return []
  }

  const values: unknown[] = []
  const seen = new Set<unknown>()
  for (let i = 0; i < rows.length; i++) {
    const value = rows[i][columnIndex]
    if (!seen.has(value)) {
      seen.add(value)
      values.push(value)
    }
  }
  return values
}

function attachUniqueRawChildren(
  parentRows: readonly unknown[][],
  parents: readonly Record<string, unknown>[],
  parentColumnIndex: number,
  childRows: readonly unknown[][],
  children: readonly Record<string, unknown>[],
  childColumnIndex: number,
  fieldName: string,
): void {
  for (let parentIndex = 0; parentIndex < parents.length; parentIndex++) {
    const parentKey = parentRows[parentIndex][parentColumnIndex]
    let child: Record<string, unknown> | null = null
    for (let childIndex = 0; childIndex < children.length; childIndex++) {
      if (childRows[childIndex][childColumnIndex] === parentKey) {
        child = children[childIndex]
        break
      }
    }
    parents[parentIndex][fieldName] = child
  }
}

function attachManyRawChildren(
  parentRows: readonly unknown[][],
  parents: readonly Record<string, unknown>[],
  parentColumnIndex: number,
  childRows: readonly unknown[][],
  children: readonly Record<string, unknown>[],
  childColumnIndex: number,
  fieldName: string,
): void {
  for (let parentIndex = 0; parentIndex < parents.length; parentIndex++) {
    const parentKey = parentRows[parentIndex][parentColumnIndex]
    const childList: Record<string, unknown>[] = []
    for (let childIndex = 0; childIndex < children.length; childIndex++) {
      if (childRows[childIndex][childColumnIndex] === parentKey) {
        childList.push(children[childIndex])
      }
    }
    parents[parentIndex][fieldName] = childList
  }
}

function attachManyToManyRawChildren(
  parentRows: readonly unknown[][],
  parents: readonly Record<string, unknown>[],
  parentColumnIndex: number,
  joinRows: readonly unknown[][],
  joinParentColumnIndex: number,
  joinChildColumnIndex: number,
  childRows: readonly unknown[][],
  children: readonly Record<string, unknown>[],
  childColumnIndex: number,
  fieldName: string,
): void {
  for (let parentIndex = 0; parentIndex < parents.length; parentIndex++) {
    const parentKey = parentRows[parentIndex][parentColumnIndex]
    const childList: Record<string, unknown>[] = []
    for (let joinIndex = 0; joinIndex < joinRows.length; joinIndex++) {
      const joinRow = joinRows[joinIndex]
      if (joinRow[joinParentColumnIndex] !== parentKey) {
        continue
      }

      const childKey = joinRow[joinChildColumnIndex]
      for (let childIndex = 0; childIndex < children.length; childIndex++) {
        if (childRows[childIndex][childColumnIndex] === childKey) {
          childList.push(children[childIndex])
          break
        }
      }
    }
    parents[parentIndex][fieldName] = childList
  }
}

function attachManyToManyRawWrapperChildren(
  parentRows: readonly unknown[][],
  parents: readonly Record<string, unknown>[],
  parentColumnIndex: number,
  joinRows: readonly unknown[][],
  joinParentColumnIndex: number,
  joinChildColumnIndex: number,
  childRows: readonly unknown[][],
  children: readonly Record<string, unknown>[],
  childColumnIndex: number,
  fieldName: string,
  wrapperFieldName: string,
): void {
  for (let parentIndex = 0; parentIndex < parents.length; parentIndex++) {
    const parentKey = parentRows[parentIndex][parentColumnIndex]
    const childList: Record<string, unknown>[] = []
    for (let joinIndex = 0; joinIndex < joinRows.length; joinIndex++) {
      const joinRow = joinRows[joinIndex]
      if (joinRow[joinParentColumnIndex] !== parentKey) {
        continue
      }

      const childKey = joinRow[joinChildColumnIndex]
      for (let childIndex = 0; childIndex < children.length; childIndex++) {
        if (childRows[childIndex][childColumnIndex] === childKey) {
          childList.push({ [wrapperFieldName]: children[childIndex] })
          break
        }
      }
    }
    parents[parentIndex][fieldName] = childList
  }
}

function findRowByColumn(rows: readonly unknown[][], columnIndex: number, key: unknown): unknown[] | undefined {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]
    if (row[columnIndex] === key) {
      return row
    }
  }

  return undefined
}

function mapTagRowOrNull(row: unknown[] | undefined): Record<string, unknown> | null {
  return row === undefined ? null : mapTagRow(row)
}

function renderSingleBlogPageQuery(
  dbQuery: QueryPlanDbQuery,
  scope: Record<string, unknown>,
  generators: GeneratorRegistrySnapshot,
): SqlQuery {
  const queries = renderQuery(dbQuery, scope, generators, 999)
  if (queries.length !== 1) {
    throw new Error(`Expected one rendered blog-page query, got ${queries.length}`)
  }
  return queries[0]
}

async function executeRawResultSetBlogPagePrototype(
  dbQueries: readonly QueryPlanDbQuery[],
  placeholderValues: Record<string, unknown>,
  adapter: BlogPageSqliteAdapter,
  generators: GeneratorRegistrySnapshot,
  exactShape = false,
): Promise<Record<string, unknown> | null> {
  const postResultSet = await adapter.queryRaw(renderSingleBlogPageQuery(dbQueries[0], placeholderValues, generators))
  const postRows = postResultSet.rows
  if (postRows.length === 0) {
    return null
  }

  const postIds = uniqueColumnValues(postRows, 0)
  const authorIds = uniqueColumnValues(postRows, 7)
  const categoryIds = uniqueColumnValues(postRows, 8)

  const [authorResultSet, categoryResultSet, postTagResultSet, commentResultSet] = await Promise.all([
    adapter.queryRaw(renderSingleBlogPageQuery(dbQueries[1], { '@parent$authorId': authorIds }, generators)),
    adapter.queryRaw(renderSingleBlogPageQuery(dbQueries[2], { '@parent$categoryId': categoryIds }, generators)),
    adapter.queryRaw(renderSingleBlogPageQuery(dbQueries[3], { '@parent$id': postIds }, generators)),
    adapter.queryRaw(renderSingleBlogPageQuery(dbQueries[5], { '@parent$id': postIds }, generators)),
  ])

  const tagIds = uniqueColumnValues(postTagResultSet.rows, 1)
  const commentAuthorIds = uniqueColumnValues(commentResultSet.rows, 3)
  const [tagResultSet, commentAuthorResultSet] = await Promise.all([
    adapter.queryRaw(renderSingleBlogPageQuery(dbQueries[4], { '@parent$tagId': tagIds }, generators)),
    adapter.queryRaw(renderSingleBlogPageQuery(dbQueries[6], { '@parent$authorId': commentAuthorIds }, generators)),
  ])

  const posts = mapRawRows(postRows, RAW_POST_COLUMNS)
  const authors = mapRawRows(authorResultSet.rows, RAW_USER_COLUMNS)
  const categories = mapRawRows(categoryResultSet.rows, RAW_CATEGORY_COLUMNS)
  const tags = mapRawRows(tagResultSet.rows, RAW_TAG_COLUMNS)
  const comments = mapRawRows(commentResultSet.rows, RAW_COMMENT_COLUMNS)
  const commentAuthors = mapRawRows(commentAuthorResultSet.rows, RAW_USER_COLUMNS)

  attachUniqueRawChildren(postRows, posts, 7, authorResultSet.rows, authors, 0, 'author')
  attachUniqueRawChildren(postRows, posts, 8, categoryResultSet.rows, categories, 0, 'category')
  if (exactShape) {
    attachManyToManyRawWrapperChildren(
      postRows,
      posts,
      0,
      postTagResultSet.rows,
      0,
      1,
      tagResultSet.rows,
      tags,
      0,
      'tags',
      'tag',
    )
  } else {
    attachManyToManyRawChildren(postRows, posts, 0, postTagResultSet.rows, 0, 1, tagResultSet.rows, tags, 0, 'tags')
  }
  attachUniqueRawChildren(commentResultSet.rows, comments, 3, commentAuthorResultSet.rows, commentAuthors, 0, 'author')
  attachManyRawChildren(postRows, posts, 0, commentResultSet.rows, comments, 4, 'comments')

  for (let i = 0; i < posts.length; i++) {
    const postRow = postRows[i]
    posts[i]._count = {
      likes: postRow[9],
      comments: postRow[10],
    }
  }

  return posts[0]
}

async function executeRawResultSetBlogPageDirectAssembler(
  dbQueries: readonly QueryPlanDbQuery[],
  placeholderValues: Record<string, unknown>,
  adapter: BlogPageSqliteAdapter,
  generators: GeneratorRegistrySnapshot,
): Promise<Record<string, unknown> | null> {
  const postResultSet = await adapter.queryRaw(renderSingleBlogPageQuery(dbQueries[0], placeholderValues, generators))
  const postRow = postResultSet.rows[0]
  if (postRow === undefined) {
    return null
  }

  const postId = postRow[0]
  const [authorResultSet, categoryResultSet, postTagResultSet, commentResultSet] = await Promise.all([
    adapter.queryRaw(renderSingleBlogPageQuery(dbQueries[1], { '@parent$authorId': postRow[7] }, generators)),
    adapter.queryRaw(renderSingleBlogPageQuery(dbQueries[2], { '@parent$categoryId': postRow[8] }, generators)),
    adapter.queryRaw(renderSingleBlogPageQuery(dbQueries[3], { '@parent$id': postId }, generators)),
    adapter.queryRaw(renderSingleBlogPageQuery(dbQueries[5], { '@parent$id': postId }, generators)),
  ])

  const postTagRows = postTagResultSet.rows
  const commentRows = commentResultSet.rows
  const [tagResultSet, commentAuthorResultSet] = await Promise.all([
    postTagRows.length === 0
      ? Promise.resolve(EMPTY_RESULT)
      : adapter.queryRaw(
          renderSingleBlogPageQuery(dbQueries[4], { '@parent$tagId': uniqueColumnValues(postTagRows, 1) }, generators),
        ),
    commentRows.length === 0
      ? Promise.resolve(EMPTY_RESULT)
      : adapter.queryRaw(
          renderSingleBlogPageQuery(
            dbQueries[6],
            { '@parent$authorId': uniqueColumnValues(commentRows, 3) },
            generators,
          ),
        ),
  ])

  const tags: Record<string, unknown>[] = []
  const tagRows = tagResultSet.rows
  for (let i = 0; i < postTagRows.length; i++) {
    const postTagRow = postTagRows[i]
    if (postTagRow[0] === postId) {
      tags.push({ tag: mapTagRowOrNull(findRowByColumn(tagRows, 0, postTagRow[1])) })
    }
  }

  const comments: Record<string, unknown>[] = []
  const commentAuthorRows = commentAuthorResultSet.rows
  for (let i = 0; i < commentRows.length; i++) {
    const commentRow = commentRows[i]
    if (commentRow[4] !== postId) {
      continue
    }

    comments.push({
      id: commentRow[0],
      content: commentRow[1],
      createdAt: commentRow[2],
      author: mapUserRow(findRowByColumn(commentAuthorRows, 0, commentRow[3])),
    })
  }

  return {
    id: postRow[0],
    title: postRow[1],
    slug: postRow[2],
    content: postRow[3],
    published: postRow[4],
    viewCount: postRow[5],
    createdAt: postRow[6],
    author: mapUserRow(findRowByColumn(authorResultSet.rows, 0, postRow[7])),
    category: mapCategoryRow(findRowByColumn(categoryResultSet.rows, 0, postRow[8])),
    tags,
    comments,
    _count: {
      likes: postRow[9],
      comments: postRow[10],
    },
  }
}

type BlogPageWriterState = {
  rootRow: readonly unknown[]
  rootId: unknown
  root: Record<string, unknown>
  postTagRows: readonly unknown[][]
  tagIds: unknown[]
  commentAuthorTargets: BlogPageCommentAuthorTarget[]
  commentAuthorIds: unknown[]
}

type BlogPageCommentAuthorTarget = {
  authorId: unknown
  comment: Record<string, unknown>
}

type BlogPageWriterPhase = {
  query: QueryPlanDbQuery
  scope: (state: BlogPageWriterState) => Record<string, unknown> | undefined
  write: (state: BlogPageWriterState, resultSet: SqlResultSet) => void
}

type CompiledBlogPageWriterProgram = {
  rootQuery: QueryPlanDbQuery
  writeRoot: (rootRow: readonly unknown[]) => BlogPageWriterState
  phaseWaves: readonly (readonly BlogPageWriterPhase[])[]
}

function compileBlogPageWriterProgram(dbQueries: readonly QueryPlanDbQuery[]): CompiledBlogPageWriterProgram {
  if (dbQueries.length !== BLOG_PAGE_RESULT_SETS.length) {
    throw new Error(`Expected ${BLOG_PAGE_RESULT_SETS.length} blog-page DB queries, got ${dbQueries.length}`)
  }

  return {
    rootQuery: dbQueries[0],
    writeRoot: (rootRow) => {
      const root = {
        id: rootRow[0],
        title: rootRow[1],
        slug: rootRow[2],
        content: rootRow[3],
        published: rootRow[4],
        viewCount: rootRow[5],
        createdAt: rootRow[6],
        author: null,
        category: null,
        tags: [] as Record<string, unknown>[],
        comments: [] as Record<string, unknown>[],
        _count: {
          likes: rootRow[9],
          comments: rootRow[10],
        },
      }

      return {
        rootRow,
        rootId: rootRow[0],
        root,
        postTagRows: [],
        tagIds: [],
        commentAuthorTargets: [],
        commentAuthorIds: [],
      }
    },
    phaseWaves: [
      [
        {
          query: dbQueries[1],
          scope: (state) => ({ '@parent$authorId': state.rootRow[7] }),
          write: (state, resultSet) => {
            state.root.author = mapUserRow(findRowByColumn(resultSet.rows, 0, state.rootRow[7]))
          },
        },
        {
          query: dbQueries[2],
          scope: (state) => ({ '@parent$categoryId': state.rootRow[8] }),
          write: (state, resultSet) => {
            state.root.category = mapCategoryRow(findRowByColumn(resultSet.rows, 0, state.rootRow[8]))
          },
        },
        {
          query: dbQueries[3],
          scope: (state) => ({ '@parent$id': state.rootId }),
          write: (state, resultSet) => {
            state.postTagRows = resultSet.rows
            state.tagIds = uniqueColumnValues(resultSet.rows, 1)
          },
        },
        {
          query: dbQueries[5],
          scope: (state) => ({ '@parent$id': state.rootId }),
          write: (state, resultSet) => {
            const comments = state.root.comments as Record<string, unknown>[]
            const seenAuthorIds = new Set<unknown>()
            for (let i = 0; i < resultSet.rows.length; i++) {
              const commentRow = resultSet.rows[i]
              if (commentRow[4] !== state.rootId) {
                continue
              }

              const comment = {
                id: commentRow[0],
                content: commentRow[1],
                createdAt: commentRow[2],
                author: null,
              }
              comments.push(comment)

              const authorId = commentRow[3]
              state.commentAuthorTargets.push({ authorId, comment })
              if (!seenAuthorIds.has(authorId)) {
                seenAuthorIds.add(authorId)
                state.commentAuthorIds.push(authorId)
              }
            }
          },
        },
      ],
      [
        {
          query: dbQueries[4],
          scope: (state) => (state.tagIds.length === 0 ? undefined : { '@parent$tagId': state.tagIds }),
          write: (state, resultSet) => {
            const tags = state.root.tags as Record<string, unknown>[]
            for (let i = 0; i < state.postTagRows.length; i++) {
              const postTagRow = state.postTagRows[i]
              if (postTagRow[0] !== state.rootId) {
                continue
              }

              tags.push({ tag: mapTagRowOrNull(findRowByColumn(resultSet.rows, 0, postTagRow[1])) })
            }
          },
        },
        {
          query: dbQueries[6],
          scope: (state) =>
            state.commentAuthorIds.length === 0 ? undefined : { '@parent$authorId': state.commentAuthorIds },
          write: (state, resultSet) => {
            for (let i = 0; i < state.commentAuthorTargets.length; i++) {
              const target = state.commentAuthorTargets[i]
              target.comment.author = mapUserRow(findRowByColumn(resultSet.rows, 0, target.authorId))
            }
          },
        },
      ],
    ],
  }
}

async function executeCompiledBlogPageWriterProgram(
  program: CompiledBlogPageWriterProgram,
  placeholderValues: Record<string, unknown>,
  adapter: BlogPageSqliteAdapter,
  generators: GeneratorRegistrySnapshot,
): Promise<Record<string, unknown> | null> {
  const rootResultSet = await adapter.queryRaw(
    renderSingleBlogPageQuery(program.rootQuery, placeholderValues, generators),
  )
  const rootRow = rootResultSet.rows[0]
  if (rootRow === undefined) {
    return null
  }

  const state = program.writeRoot(rootRow)
  for (let waveIndex = 0; waveIndex < program.phaseWaves.length; waveIndex++) {
    const wave = program.phaseWaves[waveIndex]
    const phases: BlogPageWriterPhase[] = []
    const pending: Promise<SqlResultSet>[] = []
    for (let phaseIndex = 0; phaseIndex < wave.length; phaseIndex++) {
      const phase = wave[phaseIndex]
      const scope = phase.scope(state)
      if (scope === undefined) {
        phase.write(state, EMPTY_RESULT)
        continue
      }

      phases.push(phase)
      pending.push(adapter.queryRaw(renderSingleBlogPageQuery(phase.query, scope, generators)))
    }

    const resultSets = await Promise.all(pending)
    for (let resultIndex = 0; resultIndex < resultSets.length; resultIndex++) {
      phases[resultIndex].write(state, resultSets[resultIndex])
    }
  }

  return state.root
}

async function executeCompiledBlogPageStaticWaveWriterProgram(
  program: CompiledBlogPageWriterProgram,
  placeholderValues: Record<string, unknown>,
  adapter: BlogPageSqliteAdapter,
  generators: GeneratorRegistrySnapshot,
): Promise<Record<string, unknown> | null> {
  const rootResultSet = await adapter.queryRaw(
    renderSingleBlogPageQuery(program.rootQuery, placeholderValues, generators),
  )
  const rootRow = rootResultSet.rows[0]
  if (rootRow === undefined) {
    return null
  }

  const state = program.writeRoot(rootRow)
  const firstWave = program.phaseWaves[0]
  const firstPhase0 = firstWave[0]
  const firstPhase1 = firstWave[1]
  const firstPhase2 = firstWave[2]
  const firstPhase3 = firstWave[3]
  const [firstResult0, firstResult1, firstResult2, firstResult3] = await Promise.all([
    adapter.queryRaw(renderSingleBlogPageQuery(firstPhase0.query, firstPhase0.scope(state)!, generators)),
    adapter.queryRaw(renderSingleBlogPageQuery(firstPhase1.query, firstPhase1.scope(state)!, generators)),
    adapter.queryRaw(renderSingleBlogPageQuery(firstPhase2.query, firstPhase2.scope(state)!, generators)),
    adapter.queryRaw(renderSingleBlogPageQuery(firstPhase3.query, firstPhase3.scope(state)!, generators)),
  ])
  firstPhase0.write(state, firstResult0)
  firstPhase1.write(state, firstResult1)
  firstPhase2.write(state, firstResult2)
  firstPhase3.write(state, firstResult3)

  const secondWave = program.phaseWaves[1]
  const secondPhase0 = secondWave[0]
  const secondPhase1 = secondWave[1]
  const secondScope0 = secondPhase0.scope(state)
  const secondScope1 = secondPhase1.scope(state)
  if (secondScope0 === undefined && secondScope1 === undefined) {
    secondPhase0.write(state, EMPTY_RESULT)
    secondPhase1.write(state, EMPTY_RESULT)
  } else if (secondScope0 === undefined) {
    const secondResult1 = await adapter.queryRaw(
      renderSingleBlogPageQuery(secondPhase1.query, secondScope1!, generators),
    )
    secondPhase0.write(state, EMPTY_RESULT)
    secondPhase1.write(state, secondResult1)
  } else if (secondScope1 === undefined) {
    const secondResult0 = await adapter.queryRaw(
      renderSingleBlogPageQuery(secondPhase0.query, secondScope0, generators),
    )
    secondPhase0.write(state, secondResult0)
    secondPhase1.write(state, EMPTY_RESULT)
  } else {
    const [secondResult0, secondResult1] = await Promise.all([
      adapter.queryRaw(renderSingleBlogPageQuery(secondPhase0.query, secondScope0, generators)),
      adapter.queryRaw(renderSingleBlogPageQuery(secondPhase1.query, secondScope1, generators)),
    ])
    secondPhase0.write(state, secondResult0)
    secondPhase1.write(state, secondResult1)
  }

  return state.root
}

async function measureRawResultSetBlogPagePrototypeScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: DirectPlanScenario,
): Promise<DirectPlanMeasurement> {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const adapter = new BlogPageSqliteAdapter(counts)
  const { plan, placeholderValues } = compileDirectPlan(compiler, paramGraph, scenario.query)
  const dbQueries = getDbQueries(plan)
  if (dbQueries.length !== BLOG_PAGE_RESULT_SETS.length) {
    throw new Error(`Expected ${BLOG_PAGE_RESULT_SETS.length} blog-page DB queries, got ${dbQueries.length}`)
  }

  const generators = Object.create(null) as GeneratorRegistrySnapshot
  checksumNestedBlogResult(
    await executeRawResultSetBlogPagePrototype(dbQueries, placeholderValues, adapter, generators),
  )
  resetCounts(counts)

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    checksum += checksumNestedBlogResult(
      await executeRawResultSetBlogPagePrototype(dbQueries, placeholderValues, adapter, generators),
    )
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  if (checksum < 0) {
    throw new Error('unreachable')
  }

  return {
    ...scenario,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    counts: { ...counts },
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  }
}

async function measureRawResultSetBlogPageDirectAssemblerScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: DirectPlanScenario,
): Promise<DirectPlanMeasurement> {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const adapter = new BlogPageSqliteAdapter(counts)
  const { plan, placeholderValues } = compileDirectPlan(compiler, paramGraph, scenario.query)
  const dbQueries = getDbQueries(plan)
  if (dbQueries.length !== BLOG_PAGE_RESULT_SETS.length) {
    throw new Error(`Expected ${BLOG_PAGE_RESULT_SETS.length} blog-page DB queries, got ${dbQueries.length}`)
  }

  const generators = Object.create(null) as GeneratorRegistrySnapshot
  checksumNestedBlogExactResult(
    await executeRawResultSetBlogPageDirectAssembler(dbQueries, placeholderValues, adapter, generators),
  )
  resetCounts(counts)

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    checksum += checksumNestedBlogExactResult(
      await executeRawResultSetBlogPageDirectAssembler(dbQueries, placeholderValues, adapter, generators),
    )
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  if (checksum < 0) {
    throw new Error('unreachable')
  }

  return {
    ...scenario,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    counts: { ...counts },
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  }
}

async function measureRawResultSetBlogPageWriterProgramScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: DirectPlanScenario,
  staticWaves = false,
): Promise<DirectPlanMeasurement> {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const adapter = new BlogPageSqliteAdapter(counts)
  const { plan, placeholderValues } = compileDirectPlan(compiler, paramGraph, scenario.query)
  const program = compileBlogPageWriterProgram(getDbQueries(plan))

  const generators = Object.create(null) as GeneratorRegistrySnapshot
  const execute = staticWaves ? executeCompiledBlogPageStaticWaveWriterProgram : executeCompiledBlogPageWriterProgram
  checksumNestedBlogExactResult(await execute(program, placeholderValues, adapter, generators))
  resetCounts(counts)

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    checksum += checksumNestedBlogExactResult(await execute(program, placeholderValues, adapter, generators))
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  if (checksum < 0) {
    throw new Error('unreachable')
  }

  return {
    ...scenario,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    counts: { ...counts },
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  }
}

async function measureRawResultSetBlogPageExactPrototypeScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: DirectPlanScenario,
): Promise<DirectPlanMeasurement> {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const adapter = new BlogPageSqliteAdapter(counts)
  const { plan, placeholderValues } = compileDirectPlan(compiler, paramGraph, scenario.query)
  const dbQueries = getDbQueries(plan)
  if (dbQueries.length !== BLOG_PAGE_RESULT_SETS.length) {
    throw new Error(`Expected ${BLOG_PAGE_RESULT_SETS.length} blog-page DB queries, got ${dbQueries.length}`)
  }

  const generators = Object.create(null) as GeneratorRegistrySnapshot
  checksumNestedBlogExactResult(
    await executeRawResultSetBlogPagePrototype(dbQueries, placeholderValues, adapter, generators, true),
  )
  resetCounts(counts)

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    checksum += checksumNestedBlogExactResult(
      await executeRawResultSetBlogPagePrototype(dbQueries, placeholderValues, adapter, generators, true),
    )
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  if (checksum < 0) {
    throw new Error('unreachable')
  }

  return {
    ...scenario,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    counts: { ...counts },
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  }
}

function buildRawNestedBlogPageQuery(dbQueries: readonly QueryPlanDbQuery[]): RawNestedReadQuery {
  return [
    dbQueries[0],
    RAW_POST_COLUMNS,
    [
      ['r', 'author', [dbQueries[1], RAW_USER_COLUMNS], 7, 0, '@parent$authorId', true],
      ['r', 'category', [dbQueries[2], RAW_CATEGORY_COLUMNS], 8, 0, '@parent$categoryId', true],
      [
        'r',
        'tags',
        [dbQueries[3], [], [['r', 'tag', [dbQueries[4], RAW_TAG_COLUMNS], 1, 0, '@parent$tagId', true]]],
        0,
        0,
        '@parent$id',
        false,
      ],
      [
        'r',
        'comments',
        [
          dbQueries[5],
          RAW_COMMENT_COLUMNS,
          [['r', 'author', [dbQueries[6], RAW_USER_COLUMNS], 3, 0, '@parent$authorId', true]],
        ],
        0,
        4,
        '@parent$id',
        false,
      ],
    ],
  ]
}

function buildRawNestedBlogPageExactQuery(dbQueries: readonly QueryPlanDbQuery[]): RawNestedReadQuery {
  return [
    dbQueries[0],
    RAW_POST_COLUMNS,
    [
      ['r', 'author', [dbQueries[1], RAW_USER_COLUMNS], 7, 0, '@parent$authorId', true],
      ['r', 'category', [dbQueries[2], RAW_CATEGORY_COLUMNS], 8, 0, '@parent$categoryId', true],
      [
        'r',
        'tags',
        [dbQueries[3], [], [['r', 'tag', [dbQueries[4], RAW_TAG_COLUMNS], 1, 0, '@parent$tagId', true]]],
        0,
        0,
        '@parent$id',
        false,
      ],
      [
        'r',
        'comments',
        [
          dbQueries[5],
          RAW_COMMENT_COLUMNS,
          [['r', 'author', [dbQueries[6], RAW_USER_COLUMNS], 3, 0, '@parent$authorId', true]],
        ],
        0,
        4,
        '@parent$id',
        false,
      ],
    ],
  ]
}

async function measureRawResultSetCompactNodeScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: DirectPlanScenario,
  exactShape = false,
): Promise<DirectPlanMeasurement> {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const interpreter = QueryInterpreter.forSql({
    tracingHelper: noopTracingHelper,
    provider: 'sqlite',
    connectionInfo: {
      supportsRelationJoins: false,
    },
    resultFormat: 'js',
  })
  const adapter = new BlogPageSqliteAdapter(counts)
  const { plan, placeholderValues } = compileDirectPlan(compiler, paramGraph, scenario.query)
  const dbQueries = getDbQueries(plan)
  if (dbQueries.length !== BLOG_PAGE_RESULT_SETS.length) {
    throw new Error(`Expected ${BLOG_PAGE_RESULT_SETS.length} blog-page DB queries, got ${dbQueries.length}`)
  }

  const rawPlan = [
    'n',
    exactShape ? buildRawNestedBlogPageExactQuery(dbQueries) : buildRawNestedBlogPageQuery(dbQueries),
    true,
  ] as const satisfies QueryPlanNode
  const checksumResult = exactShape ? checksumNestedBlogExactResult : checksumNestedBlogResult
  await interpreter.run(rawPlan, {
    queryable: adapter,
    scope: placeholderValues,
    transactionManager: { enabled: false },
  })
  resetCounts(counts)

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    checksum += checksumResult(
      await interpreter.run(rawPlan, {
        queryable: adapter,
        scope: placeholderValues,
        transactionManager: { enabled: false },
      }),
    )
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  if (checksum < 0) {
    throw new Error('unreachable')
  }

  return {
    ...scenario,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    counts: { ...counts },
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  }
}

function getPrecomputedBlogPageQueryScope(): Record<string, unknown> {
  const scope = Object.create(null) as Record<string, unknown>
  for (let i = 0; i < BLOG_PAGE_RESULT_SETS.length; i++) {
    scope[`precomputedQuery${i}`] = serializeSql(BLOG_PAGE_RESULT_SETS[i])
  }
  return scope
}

function getPrecomputedRootJoinChildResultSets(parentField: string): readonly SqlResultSet[] {
  switch (parentField) {
    case '@nested$author':
      return [BLOG_PAGE_POST_RESULT, BLOG_PAGE_AUTHOR_RESULT]
    case '@nested$category':
      return [BLOG_PAGE_POST_RESULT, BLOG_PAGE_CATEGORY_RESULT]
    case '@nested$tags':
      return [BLOG_PAGE_POST_RESULT, BLOG_PAGE_POST_TAG_RESULT, BLOG_PAGE_TAG_RESULT]
    case '@nested$comments':
      return [BLOG_PAGE_POST_RESULT, BLOG_PAGE_COMMENT_RESULT, BLOG_PAGE_COMMENT_AUTHOR_RESULT]
    default:
      throw new Error(`Unexpected root join child field: ${parentField}`)
  }
}

function getPrecomputedQueryScope(resultSets: readonly SqlResultSet[]): Record<string, unknown> {
  const scope = Object.create(null) as Record<string, unknown>
  for (let i = 0; i < resultSets.length; i++) {
    scope[`precomputedQuery${i}`] = serializeSql(resultSets[i])
  }
  return scope
}

function getRootJoinChildLabel(parentField: string): string {
  return parentField.startsWith('@nested$') ? parentField.slice('@nested$'.length) : parentField
}

function checksumRootJoinChildValue(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length
  }

  return isRecord(value) ? 1 : 0
}

async function measurePrecomputedQueryLeavesScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: DirectPlanScenario,
): Promise<PlanPhaseMeasurement> {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const interpreter = QueryInterpreter.forSql({
    tracingHelper: noopTracingHelper,
    provider: 'sqlite',
    connectionInfo: {
      supportsRelationJoins: false,
    },
    resultFormat: 'js',
  })
  const adapter = createAdapter(counts)
  const { plan, placeholderValues } = compileDirectPlan(compiler, paramGraph, scenario.query)
  const { expr } = getRootDataMapPlan(plan)
  const replacementState = { index: 0 }
  const precomputedExpr = replaceQueryLeavesWithPrecomputedGetters(expr, replacementState)
  if (replacementState.index !== BLOG_PAGE_RESULT_SETS.length) {
    throw new Error(`Expected ${BLOG_PAGE_RESULT_SETS.length} query leaves, got ${replacementState.index}`)
  }

  const scopes = new Array<Record<string, unknown>>(scenario.iterations)
  for (let i = 0; i < scenario.iterations; i++) {
    scopes[i] = {
      ...placeholderValues,
      ...getPrecomputedBlogPageQueryScope(),
    }
  }

  for (let i = 0; i < scenario.iterations; i++) {
    await interpreter.run(precomputedExpr, {
      queryable: adapter,
      scope: {
        ...placeholderValues,
        ...getPrecomputedBlogPageQueryScope(),
      },
      transactionManager: { enabled: false },
    })
  }
  resetCounts(counts)

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    checksum += checksumNestedBlogInnerValue(
      await interpreter.run(precomputedExpr, {
        queryable: adapter,
        scope: scopes[i],
        transactionManager: { enabled: false },
      }),
    )
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    name: scenario.name,
    iterations: scenario.iterations,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    checksum,
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  }
}

async function measurePrecomputedRootJoinChildBranchScenarios(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: DirectPlanScenario,
): Promise<PlanPhaseMeasurement[]> {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const interpreter = QueryInterpreter.forSql({
    tracingHelper: noopTracingHelper,
    provider: 'sqlite',
    connectionInfo: {
      supportsRelationJoins: false,
    },
    resultFormat: 'js',
  })
  const adapter = createAdapter(counts)
  const { plan, placeholderValues } = compileDirectPlan(compiler, paramGraph, scenario.query)
  const { expr } = getRootDataMapPlan(plan)
  const rootJoin = getRootCompactJoin(expr)
  const rootJoinChildren = rootJoin[2] as CompactJoinExpression[]
  const rootJoinChildPlans = getRootCompactJoinChildPlans(expr)
  if (rootJoinChildPlans.length !== rootJoinChildren.length) {
    throw new Error(`Expected ${rootJoinChildren.length} root join child plans, got ${rootJoinChildPlans.length}`)
  }

  const measurements: PlanPhaseMeasurement[] = []
  for (let childIndex = 0; childIndex < rootJoinChildren.length; childIndex++) {
    const parentField = rootJoinChildren[childIndex][2]
    const resultSets = getPrecomputedRootJoinChildResultSets(parentField)
    const replacementState = { index: 0 }
    const precomputedChildPlan = replaceQueryLeavesWithPrecomputedGetters(
      rootJoinChildPlans[childIndex],
      replacementState,
    )
    if (replacementState.index !== resultSets.length) {
      throw new Error(`Expected ${resultSets.length} query leaves for ${parentField}, got ${replacementState.index}`)
    }

    const scopes = new Array<Record<string, unknown>>(scenario.iterations)
    for (let i = 0; i < scenario.iterations; i++) {
      scopes[i] = {
        ...placeholderValues,
        ...getPrecomputedQueryScope(resultSets),
      }
    }

    for (let i = 0; i < scenario.iterations; i++) {
      await interpreter.run(precomputedChildPlan, {
        queryable: adapter,
        scope: scopes[i],
        transactionManager: { enabled: false },
      })
    }
    resetCounts(counts)

    let checksum = 0
    const beforeHeap = heapUsed()
    const started = performance.now()
    for (let i = 0; i < scenario.iterations; i++) {
      checksum += checksumRootJoinChildValue(
        await interpreter.run(precomputedChildPlan, {
          queryable: adapter,
          scope: scopes[i],
          transactionManager: { enabled: false },
        }),
      )
    }
    const elapsedMs = performance.now() - started
    const afterHeap = heapUsed()

    measurements.push({
      name: scenario.name.replace('blog page', `blog page ${getRootJoinChildLabel(parentField)}`),
      iterations: scenario.iterations,
      elapsedMs,
      averageUs: (elapsedMs * 1000) / scenario.iterations,
      checksum,
      heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
    })
  }

  return measurements
}

async function measurePrecomputedJoinLeavesScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: DirectPlanScenario,
): Promise<PlanPhaseMeasurement> {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const interpreter = QueryInterpreter.forSql({
    tracingHelper: noopTracingHelper,
    provider: 'sqlite',
    connectionInfo: {
      supportsRelationJoins: false,
    },
    resultFormat: 'js',
  })
  const adapter = await createScenarioAdapter(counts, scenario)
  const emptyAdapter = createAdapter(counts)
  const { plan, placeholderValues } = compileDirectPlan(compiler, paramGraph, scenario.query)
  const { expr } = getRootDataMapPlan(plan)
  const replacementState = { queryIndex: 0, joinIndex: 0 }
  const precomputedExpr = replaceQueryAndJoinLeavesWithPrecomputedGetters(expr, replacementState)
  if (replacementState.queryIndex !== 1 || replacementState.joinIndex !== 1) {
    throw new Error(
      `Expected one top-level query leaf and one top-level join leaf, got ${replacementState.queryIndex} queries and ${replacementState.joinIndex} joins`,
    )
  }

  const scopes = new Array<Record<string, unknown>>(scenario.iterations)
  for (let i = 0; i < scenario.iterations; i++) {
    scopes[i] = {
      ...placeholderValues,
      precomputedQuery0: serializeSql(BLOG_PAGE_POST_RESULT),
      precomputedJoin0: await interpreter.run(expr, {
        queryable: adapter,
        scope: placeholderValues,
        transactionManager: { enabled: false },
      }),
    }
  }

  for (let i = 0; i < scenario.iterations; i++) {
    await interpreter.run(precomputedExpr, {
      queryable: emptyAdapter,
      scope: scopes[i],
      transactionManager: { enabled: false },
    })
  }
  resetCounts(counts)

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    checksum += checksumNestedBlogInnerValue(
      await interpreter.run(precomputedExpr, {
        queryable: emptyAdapter,
        scope: scopes[i],
        transactionManager: { enabled: false },
      }),
    )
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    name: scenario.name,
    iterations: scenario.iterations,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    checksum,
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  }
}

async function measurePrecomputedRootJoinChildrenScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: DirectPlanScenario,
): Promise<PlanPhaseMeasurement> {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const interpreter = QueryInterpreter.forSql({
    tracingHelper: noopTracingHelper,
    provider: 'sqlite',
    connectionInfo: {
      supportsRelationJoins: false,
    },
    resultFormat: 'js',
  })
  const adapter = await createScenarioAdapter(counts, scenario)
  const emptyAdapter = createAdapter(counts)
  const { plan, placeholderValues } = compileDirectPlan(compiler, paramGraph, scenario.query)
  const { expr } = getRootDataMapPlan(plan)
  const rootJoin = getRootCompactJoin(expr)
  const rootJoinChildren = rootJoin[2] as CompactJoinExpression[]
  const rootJoinChildPlans = getRootCompactJoinChildPlans(expr)
  const replacementState = { queryIndex: 0, childIndex: 0, foundJoin: false }
  const precomputedExpr = replaceRootJoinChildrenWithPrecomputedGetters(expr, replacementState)
  if (!replacementState.foundJoin || replacementState.queryIndex !== 1) {
    throw new Error(
      `Expected one root join and one precomputed query, got foundJoin=${replacementState.foundJoin} and ${replacementState.queryIndex} queries`,
    )
  }
  if (replacementState.childIndex !== rootJoinChildren.length) {
    throw new Error(`Expected ${rootJoinChildren.length} root join children, got ${replacementState.childIndex}`)
  }
  if (rootJoinChildPlans.length !== rootJoinChildren.length) {
    throw new Error(`Expected ${rootJoinChildren.length} root join child plans, got ${rootJoinChildPlans.length}`)
  }

  const scopes = new Array<Record<string, unknown>>(scenario.iterations)
  for (let i = 0; i < scenario.iterations; i++) {
    const scope = {
      ...placeholderValues,
      precomputedQuery0: serializeSql(BLOG_PAGE_POST_RESULT),
    }
    for (let childIndex = 0; childIndex < rootJoinChildren.length; childIndex++) {
      scope[`precomputedRootJoinChild${childIndex}`] = await interpreter.run(rootJoinChildPlans[childIndex], {
        queryable: adapter,
        scope: placeholderValues,
        transactionManager: { enabled: false },
      })
    }
    scopes[i] = scope
  }

  for (let i = 0; i < scenario.iterations; i++) {
    await interpreter.run(precomputedExpr, {
      queryable: emptyAdapter,
      scope: scopes[i],
      transactionManager: { enabled: false },
    })
  }
  resetCounts(counts)

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    checksum += checksumNestedBlogInnerValue(
      await interpreter.run(precomputedExpr, {
        queryable: emptyAdapter,
        scope: scopes[i],
        transactionManager: { enabled: false },
      }),
    )
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    name: scenario.name,
    iterations: scenario.iterations,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    checksum,
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  }
}

async function measureInnerPlanScenario(compiler: QueryCompiler, paramGraph: ParamGraph, scenario: DirectPlanScenario) {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const interpreter = QueryInterpreter.forSql({
    tracingHelper: noopTracingHelper,
    provider: 'sqlite',
    connectionInfo: {
      supportsRelationJoins: false,
    },
    resultFormat: 'js',
  })
  const adapter = await createScenarioAdapter(counts, scenario)
  const { plan, placeholderValues } = compileDirectPlan(compiler, paramGraph, scenario.query)
  const { expr } = getRootDataMapPlan(plan)

  await interpreter.run(expr, {
    queryable: adapter,
    scope: placeholderValues,
    transactionManager: { enabled: false },
  })
  resetCounts(counts)

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    checksum += checksumNestedBlogInnerValue(
      await interpreter.run(expr, {
        queryable: adapter,
        scope: placeholderValues,
        transactionManager: { enabled: false },
      }),
    )
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  if (checksum < 0) {
    throw new Error('unreachable')
  }

  return {
    ...scenario,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    counts: { ...counts },
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  } satisfies DirectPlanMeasurement
}

async function measureOuterDataMapScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: DirectPlanScenario,
): Promise<PlanPhaseMeasurement> {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const interpreter = QueryInterpreter.forSql({
    tracingHelper: noopTracingHelper,
    provider: 'sqlite',
    connectionInfo: {
      supportsRelationJoins: false,
    },
    resultFormat: 'js',
  })
  const adapter = await createScenarioAdapter(counts, scenario)
  const { plan, placeholderValues } = compileDirectPlan(compiler, paramGraph, scenario.query)
  const { expr, structure, enums } = getRootDataMapPlan(plan)
  const innerValues = new Array<unknown>(scenario.iterations)
  for (let i = 0; i < scenario.iterations; i++) {
    innerValues[i] = await interpreter.run(expr, {
      queryable: adapter,
      scope: placeholderValues,
      transactionManager: { enabled: false },
    })
  }

  for (let i = 0; i < scenario.iterations; i++) {
    applyDataMap(innerValues[i] as never, structure, enums, 'js')
  }

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    checksum += checksumNestedBlogResult(applyDataMap(innerValues[i] as never, structure, enums, 'js'))
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    name: scenario.name,
    iterations: scenario.iterations,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    checksum,
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  }
}

async function measureInterpreterGetPrecomputedScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: DirectPlanScenario,
): Promise<PlanPhaseMeasurement> {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const interpreter = QueryInterpreter.forSql({
    tracingHelper: noopTracingHelper,
    provider: 'sqlite',
    connectionInfo: {
      supportsRelationJoins: false,
    },
    resultFormat: 'js',
  })
  const adapter = await createScenarioAdapter(counts, scenario)
  const { plan, placeholderValues } = compileDirectPlan(compiler, paramGraph, scenario.query)
  const { expr } = getRootDataMapPlan(plan)
  const innerValues = new Array<unknown>(scenario.iterations)
  const scopes = new Array<Record<string, unknown>>(scenario.iterations)
  for (let i = 0; i < scenario.iterations; i++) {
    innerValues[i] = await interpreter.run(expr, {
      queryable: adapter,
      scope: placeholderValues,
      transactionManager: { enabled: false },
    })
    scopes[i] = { value: innerValues[i] }
  }

  const getPlan = ['g', 'value'] as unknown as QueryPlanNode
  for (let i = 0; i < scenario.iterations; i++) {
    await interpreter.run(getPlan, {
      queryable: adapter,
      scope: scopes[i],
      transactionManager: { enabled: false },
    })
  }

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    checksum += checksumNestedBlogInnerValue(
      await interpreter.run(getPlan, {
        queryable: adapter,
        scope: scopes[i],
        transactionManager: { enabled: false },
      }),
    )
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    name: scenario.name,
    iterations: scenario.iterations,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    checksum,
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  }
}

async function measureInterpreterUnitScenario(scenario: DirectPlanScenario): Promise<PlanPhaseMeasurement> {
  const interpreter = QueryInterpreter.forSql({
    tracingHelper: noopTracingHelper,
    provider: 'sqlite',
    connectionInfo: {
      supportsRelationJoins: false,
    },
    resultFormat: 'js',
  })
  const plan = ['0'] as unknown as QueryPlanNode
  const runtimeOptions = {
    queryable: {},
    scope: Object.create(null) as Record<string, unknown>,
    transactionManager: { enabled: false as const },
  }

  for (let i = 0; i < scenario.iterations; i++) {
    await interpreter.run(plan, runtimeOptions)
  }

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    if ((await interpreter.run(plan, runtimeOptions)) === undefined) {
      checksum++
    }
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    name: scenario.name,
    iterations: scenario.iterations,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    checksum,
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  }
}

async function measureInterpreterDataMapPrecomputedScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: DirectPlanScenario,
): Promise<PlanPhaseMeasurement> {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const interpreter = QueryInterpreter.forSql({
    tracingHelper: noopTracingHelper,
    provider: 'sqlite',
    connectionInfo: {
      supportsRelationJoins: false,
    },
    resultFormat: 'js',
  })
  const adapter = await createScenarioAdapter(counts, scenario)
  const { plan, placeholderValues } = compileDirectPlan(compiler, paramGraph, scenario.query)
  const { expr, structure, enums } = getRootDataMapPlan(plan)
  const innerValues = new Array<unknown>(scenario.iterations)
  const scopes = new Array<Record<string, unknown>>(scenario.iterations)
  for (let i = 0; i < scenario.iterations; i++) {
    innerValues[i] = await interpreter.run(expr, {
      queryable: adapter,
      scope: placeholderValues,
      transactionManager: { enabled: false },
    })
    scopes[i] = { value: innerValues[i] }
  }

  const dataMapPlan = ['d', ['g', 'value'], structure, enums] as unknown as QueryPlanNode
  for (let i = 0; i < scenario.iterations; i++) {
    await interpreter.run(dataMapPlan, {
      queryable: adapter,
      scope: scopes[i],
      transactionManager: { enabled: false },
    })
  }

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    checksum += checksumNestedBlogResult(
      await interpreter.run(dataMapPlan, {
        queryable: adapter,
        scope: scopes[i],
        transactionManager: { enabled: false },
      }),
    )
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  return {
    name: scenario.name,
    iterations: scenario.iterations,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    checksum,
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  }
}

async function measureManualInnerOuterDataMapScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: DirectPlanScenario,
) {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const interpreter = QueryInterpreter.forSql({
    tracingHelper: noopTracingHelper,
    provider: 'sqlite',
    connectionInfo: {
      supportsRelationJoins: false,
    },
    resultFormat: 'js',
  })
  const adapter = await createScenarioAdapter(counts, scenario)
  const { plan, placeholderValues } = compileDirectPlan(compiler, paramGraph, scenario.query)
  const { expr, structure, enums } = getRootDataMapPlan(plan)

  checksumNestedBlogResult(
    applyDataMap(
      (await interpreter.run(expr, {
        queryable: adapter,
        scope: placeholderValues,
        transactionManager: { enabled: false },
      })) as never,
      structure,
      enums,
      'js',
    ),
  )
  resetCounts(counts)

  let checksum = 0
  const beforeHeap = heapUsed()
  const started = performance.now()
  for (let i = 0; i < scenario.iterations; i++) {
    checksum += checksumNestedBlogResult(
      applyDataMap(
        (await interpreter.run(expr, {
          queryable: adapter,
          scope: placeholderValues,
          transactionManager: { enabled: false },
        })) as never,
        structure,
        enums,
        'js',
      ),
    )
  }
  const elapsedMs = performance.now() - started
  const afterHeap = heapUsed()

  if (checksum < 0) {
    throw new Error('unreachable')
  }

  return {
    ...scenario,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / scenario.iterations,
    counts: { ...counts },
    heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
  } satisfies DirectPlanMeasurement
}

async function measureLocalExecutorScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: DirectPlanScenario,
) {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const executor = await LocalExecutor.connect({
    driverAdapterFactory: scenario.adapterFactory?.(counts) ?? createAdapterFactory(counts, scenario.resultSet),
    transactionOptions: {
      maxWait: 2000,
      timeout: 5000,
    },
    tracingHelper: noopTracingHelper,
    provider: 'sqlite',
  })
  const { plan, placeholderValues } = compileDirectPlan(compiler, paramGraph, scenario.query)

  try {
    await executor.execute({
      plan,
      model: scenario.query.modelName,
      operation: scenario.query.action,
      placeholderValues,
      transaction: undefined,
      batchIndex: undefined,
    })
    resetCounts(counts)

    const beforeHeap = heapUsed()
    const started = performance.now()
    for (let i = 0; i < scenario.iterations; i++) {
      await executor.execute({
        plan,
        model: scenario.query.modelName,
        operation: scenario.query.action,
        placeholderValues,
        transaction: undefined,
        batchIndex: undefined,
      })
    }
    const elapsedMs = performance.now() - started
    const afterHeap = heapUsed()

    return {
      ...scenario,
      elapsedMs,
      averageUs: (elapsedMs * 1000) / scenario.iterations,
      counts: { ...counts },
      heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
    } satisfies DirectPlanMeasurement
  } finally {
    await executor.disconnect()
  }
}

async function measureLocalExecutorScopeScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: DirectPlanScopeScenario,
) {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const executor = await LocalExecutor.connect({
    driverAdapterFactory: scenario.adapterFactory?.(counts) ?? createAdapterFactory(counts, scenario.resultSet),
    transactionOptions: {
      maxWait: 2000,
      timeout: 5000,
    },
    tracingHelper: noopTracingHelper,
    provider: 'sqlite',
  })
  const firstQuery = scenario.query(0)
  const { plan } = compileDirectPlan(compiler, paramGraph, firstQuery)
  const placeholderValues = new Array<Record<string, unknown>>(scenario.iterations)
  for (let i = 0; i < scenario.iterations; i++) {
    placeholderValues[i] = parameterizeQuery(scenario.query(i), paramGraph).placeholderValues
  }

  try {
    await executor.execute({
      plan,
      model: firstQuery.modelName,
      operation: firstQuery.action,
      placeholderValues: placeholderValues[0],
      transaction: undefined,
      batchIndex: undefined,
    })
    resetCounts(counts)

    const beforeHeap = heapUsed()
    const started = performance.now()
    for (let i = 0; i < scenario.iterations; i++) {
      await executor.execute({
        plan,
        model: firstQuery.modelName,
        operation: firstQuery.action,
        placeholderValues: placeholderValues[i],
        transaction: undefined,
        batchIndex: undefined,
      })
    }
    const elapsedMs = performance.now() - started
    const afterHeap = heapUsed()

    return {
      ...scenario,
      query: firstQuery,
      elapsedMs,
      averageUs: (elapsedMs * 1000) / scenario.iterations,
      counts: { ...counts },
      heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
    } satisfies DirectPlanMeasurement
  } finally {
    await executor.disconnect()
  }
}

async function measureCachedRequestWrapperScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: CacheKeyScenario,
) {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const executor = await LocalExecutor.connect({
    driverAdapterFactory: scenario.adapterFactory?.(counts) ?? createAdapterFactory(counts, scenario.resultSet),
    transactionOptions: {
      maxWait: 2000,
      timeout: 5000,
    },
    tracingHelper: noopTracingHelper,
    provider: 'sqlite',
  })
  const firstQuery = scenario.query(0)
  const cache = new QueryPlanCache(100)
  const { parameterizedQuery: firstParameterizedQuery } = parameterizeQuery(firstQuery, paramGraph)
  const firstQueryPart = JSON.stringify(firstParameterizedQuery.query)
  const firstCacheKey = getSingleQueryCacheKey(firstParameterizedQuery, firstQueryPart)
  cache.setSingle(firstCacheKey, compiler.compile(getSingleQueryRequest(firstParameterizedQuery, firstQueryPart)))

  const queries = new Array<JsonQuery>(scenario.iterations)
  for (let i = 0; i < scenario.iterations; i++) {
    queries[i] = scenario.query(i)
  }

  let consumedResults = 0
  try {
    for (let i = 0; i < scenario.iterations; i++) {
      const query = queries[i]
      const { parameterizedQuery, placeholderValues } = parameterizeQuery(query, paramGraph)
      const queryPart = JSON.stringify(parameterizedQuery.query)
      const plan = cache.getSingle(getSingleQueryCacheKey(parameterizedQuery, queryPart))!
      const result = await executor.execute({
        plan,
        model: query.modelName,
        operation: query.action,
        placeholderValues,
        transaction: undefined,
        batchIndex: undefined,
      })
      const response = {
        data: { [query.action]: result },
        [queryEngineResultDataWasDeserialized]: true,
      }
      consumedResults += response.data[query.action] === undefined ? 0 : 1
    }
    resetCounts(counts)

    const beforeHeap = heapUsed()
    const started = performance.now()
    for (let i = 0; i < scenario.iterations; i++) {
      const query = queries[i]
      const { parameterizedQuery, placeholderValues } = parameterizeQuery(query, paramGraph)
      const queryPart = JSON.stringify(parameterizedQuery.query)
      const plan = cache.getSingle(getSingleQueryCacheKey(parameterizedQuery, queryPart))!
      const result = await executor.execute({
        plan,
        model: query.modelName,
        operation: query.action,
        placeholderValues,
        transaction: undefined,
        batchIndex: undefined,
      })
      const response = {
        data: { [query.action]: result },
        [queryEngineResultDataWasDeserialized]: true,
      }
      consumedResults += response.data[query.action] === undefined ? 0 : 1
    }
    const elapsedMs = performance.now() - started
    const afterHeap = heapUsed()

    if (consumedResults < 0) {
      throw new Error('unreachable')
    }

    return {
      ...scenario,
      query: firstQuery,
      elapsedMs,
      averageUs: (elapsedMs * 1000) / scenario.iterations,
      counts: { ...counts },
      heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
    } satisfies DirectPlanMeasurement
  } finally {
    await executor.disconnect()
  }
}

async function measureCachedRequestWrapperPrecomputedKeyScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: CacheKeyScenario,
) {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const executor = await LocalExecutor.connect({
    driverAdapterFactory: scenario.adapterFactory?.(counts) ?? createAdapterFactory(counts, scenario.resultSet),
    transactionOptions: {
      maxWait: 2000,
      timeout: 5000,
    },
    tracingHelper: noopTracingHelper,
    provider: 'sqlite',
  })
  const firstQuery = scenario.query(0)
  const cache = new QueryPlanCache(100)
  const { parameterizedQuery: firstParameterizedQuery } = parameterizeQuery(firstQuery, paramGraph)
  const firstQueryPart = JSON.stringify(firstParameterizedQuery.query)
  const firstCacheKey = getSingleQueryCacheKey(firstParameterizedQuery, firstQueryPart)
  cache.setSingle(firstCacheKey, compiler.compile(getSingleQueryRequest(firstParameterizedQuery, firstQueryPart)))

  const requests = new Array<{
    query: JsonQuery
    cacheKey: string
    placeholderValues: Record<string, unknown>
  }>(scenario.iterations)
  for (let i = 0; i < scenario.iterations; i++) {
    const query = scenario.query(i)
    const { parameterizedQuery, placeholderValues } = parameterizeQuery(query, paramGraph)
    const queryPart = JSON.stringify(parameterizedQuery.query)
    requests[i] = {
      query,
      cacheKey: getSingleQueryCacheKey(parameterizedQuery, queryPart),
      placeholderValues,
    }
  }

  let consumedResults = 0
  try {
    for (let i = 0; i < scenario.iterations; i++) {
      const request = requests[i]
      const plan = cache.getSingle(request.cacheKey)!
      const result = await executor.execute({
        plan,
        model: request.query.modelName,
        operation: request.query.action,
        placeholderValues: request.placeholderValues,
        transaction: undefined,
        batchIndex: undefined,
      })
      const response = {
        data: { [request.query.action]: result },
        [queryEngineResultDataWasDeserialized]: true,
      }
      consumedResults += response.data[request.query.action] === undefined ? 0 : 1
    }
    resetCounts(counts)

    const beforeHeap = heapUsed()
    const started = performance.now()
    for (let i = 0; i < scenario.iterations; i++) {
      const request = requests[i]
      const plan = cache.getSingle(request.cacheKey)!
      const result = await executor.execute({
        plan,
        model: request.query.modelName,
        operation: request.query.action,
        placeholderValues: request.placeholderValues,
        transaction: undefined,
        batchIndex: undefined,
      })
      const response = {
        data: { [request.query.action]: result },
        [queryEngineResultDataWasDeserialized]: true,
      }
      consumedResults += response.data[request.query.action] === undefined ? 0 : 1
    }
    const elapsedMs = performance.now() - started
    const afterHeap = heapUsed()

    if (consumedResults < 0) {
      throw new Error('unreachable')
    }

    return {
      ...scenario,
      query: firstQuery,
      elapsedMs,
      averageUs: (elapsedMs * 1000) / scenario.iterations,
      counts: { ...counts },
      heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
    } satisfies DirectPlanMeasurement
  } finally {
    await executor.disconnect()
  }
}

async function measureCachedRequestWrapperStaticShapeScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: CacheKeyScenario & { staticShapePlaceholderValues: (iteration: number) => Record<string, unknown> },
) {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const executor = await LocalExecutor.connect({
    driverAdapterFactory: scenario.adapterFactory?.(counts) ?? createAdapterFactory(counts, scenario.resultSet),
    transactionOptions: {
      maxWait: 2000,
      timeout: 5000,
    },
    tracingHelper: noopTracingHelper,
    provider: 'sqlite',
  })
  const firstQuery = scenario.query(0)
  const cache = new QueryPlanCache(100)
  const { parameterizedQuery: firstParameterizedQuery } = parameterizeQuery(firstQuery, paramGraph)
  const firstQueryPart = JSON.stringify(firstParameterizedQuery.query)
  const firstCacheKey = getSingleQueryCacheKey(firstParameterizedQuery, firstQueryPart)
  cache.setSingle(firstCacheKey, compiler.compile(getSingleQueryRequest(firstParameterizedQuery, firstQueryPart)))

  let consumedResults = 0
  try {
    for (let i = 0; i < scenario.iterations; i++) {
      const plan = cache.getSingle(firstCacheKey)!
      const result = await executor.execute({
        plan,
        model: firstQuery.modelName,
        operation: firstQuery.action,
        placeholderValues: scenario.staticShapePlaceholderValues(i),
        transaction: undefined,
        batchIndex: undefined,
      })
      const response = {
        data: { [firstQuery.action]: result },
        [queryEngineResultDataWasDeserialized]: true,
      }
      consumedResults += response.data[firstQuery.action] === undefined ? 0 : 1
    }
    resetCounts(counts)

    const beforeHeap = heapUsed()
    const started = performance.now()
    for (let i = 0; i < scenario.iterations; i++) {
      const plan = cache.getSingle(firstCacheKey)!
      const result = await executor.execute({
        plan,
        model: firstQuery.modelName,
        operation: firstQuery.action,
        placeholderValues: scenario.staticShapePlaceholderValues(i),
        transaction: undefined,
        batchIndex: undefined,
      })
      const response = {
        data: { [firstQuery.action]: result },
        [queryEngineResultDataWasDeserialized]: true,
      }
      consumedResults += response.data[firstQuery.action] === undefined ? 0 : 1
    }
    const elapsedMs = performance.now() - started
    const afterHeap = heapUsed()

    if (consumedResults < 0) {
      throw new Error('unreachable')
    }

    return {
      ...scenario,
      query: firstQuery,
      elapsedMs,
      averageUs: (elapsedMs * 1000) / scenario.iterations,
      counts: { ...counts },
      heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
    } satisfies DirectPlanMeasurement
  } finally {
    await executor.disconnect()
  }
}

async function measureCachedRequestWrapperGeneratedDescriptorScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  config: Omit<EngineConfig, 'adapter' | 'queryPlanCacheMaxSize'>,
  scenario: GeneratedClientSerializeScenario & { adapterFactory: ScenarioAdapterFactory },
) {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const executor = await LocalExecutor.connect({
    driverAdapterFactory: scenario.adapterFactory(counts),
    transactionOptions: {
      maxWait: 2000,
      timeout: 5000,
    },
    tracingHelper: noopTracingHelper,
    provider: 'sqlite',
  })
  const { query, parameterizedQuery, queryPart, cacheKey } = getGeneratedScenarioParameterizedShape(
    config,
    paramGraph,
    scenario,
  )
  const cache = new QueryPlanCache(100)
  cache.setSingle(cacheKey, compiler.compile(getSingleQueryRequest(parameterizedQuery, queryPart)))

  let consumedResults = 0
  try {
    for (let i = 0; i < scenario.iterations; i++) {
      const extraction = tryExtractGeneratedBlogPostPageDescriptor(scenario.args(i), cacheKey)
      if (extraction === undefined) {
        throw new Error('Expected generated blog-page descriptor to match benchmark args')
      }
      const plan = cache.getSingle(extraction.cacheKey)!
      const result = await executor.execute({
        plan,
        model: query.modelName,
        operation: query.action,
        placeholderValues: extraction.placeholderValues,
        transaction: undefined,
        batchIndex: undefined,
      })
      const response = {
        data: { [query.action]: result },
        [queryEngineResultDataWasDeserialized]: true,
      }
      consumedResults += response.data[query.action] === undefined ? 0 : 1
    }
    resetCounts(counts)

    const beforeHeap = heapUsed()
    const started = performance.now()
    for (let i = 0; i < scenario.iterations; i++) {
      const extraction = tryExtractGeneratedBlogPostPageDescriptor(scenario.args(i), cacheKey)
      if (extraction === undefined) {
        throw new Error('Expected generated blog-page descriptor to match benchmark args')
      }
      const plan = cache.getSingle(extraction.cacheKey)!
      const result = await executor.execute({
        plan,
        model: query.modelName,
        operation: query.action,
        placeholderValues: extraction.placeholderValues,
        transaction: undefined,
        batchIndex: undefined,
      })
      const response = {
        data: { [query.action]: result },
        [queryEngineResultDataWasDeserialized]: true,
      }
      consumedResults += response.data[query.action] === undefined ? 0 : 1
    }
    const elapsedMs = performance.now() - started
    const afterHeap = heapUsed()

    if (consumedResults < 0) {
      throw new Error('unreachable')
    }

    return {
      ...scenario,
      query,
      elapsedMs,
      averageUs: (elapsedMs * 1000) / scenario.iterations,
      counts: { ...counts },
      heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
    } satisfies DirectPlanMeasurement
  } finally {
    await executor.disconnect()
  }
}

async function measureCachedRequestWrapperLazyDescriptorScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  config: Omit<EngineConfig, 'adapter' | 'queryPlanCacheMaxSize'>,
  scenario: GeneratedClientSerializeScenario,
) {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const executor = await LocalExecutor.connect({
    driverAdapterFactory: scenario.adapterFactory?.(counts) ?? createAdapterFactory(counts),
    transactionOptions: {
      maxWait: 2000,
      timeout: 5000,
    },
    tracingHelper: noopTracingHelper,
    provider: 'sqlite',
  })
  const firstArgs = scenario.args(0)
  const { query, parameterizedQuery, placeholderValues, queryPart, cacheKey } = getGeneratedScenarioParameterizedShape(
    config,
    paramGraph,
    scenario,
  )
  const descriptor = buildLazyStaticDescriptor(firstArgs, cacheKey, placeholderValues)
  const cache = new QueryPlanCache(100)
  cache.setSingle(cacheKey, compiler.compile(getSingleQueryRequest(parameterizedQuery, queryPart)))

  let consumedResults = 0
  try {
    for (let i = 0; i < scenario.iterations; i++) {
      const extraction = tryExtractLazyStaticDescriptor(descriptor, scenario.args(i))
      if (extraction === undefined) {
        throw new Error('Expected lazy descriptor to match benchmark args')
      }
      const plan = cache.getSingle(extraction.cacheKey)!
      const result = await executor.execute({
        plan,
        model: query.modelName,
        operation: query.action,
        placeholderValues: extraction.placeholderValues,
        transaction: undefined,
        batchIndex: undefined,
      })
      const response = {
        data: { [query.action]: result },
        [queryEngineResultDataWasDeserialized]: true,
      }
      consumedResults += response.data[query.action] === undefined ? 0 : 1
    }
    resetCounts(counts)

    const beforeHeap = heapUsed()
    const started = performance.now()
    for (let i = 0; i < scenario.iterations; i++) {
      const extraction = tryExtractLazyStaticDescriptor(descriptor, scenario.args(i))
      if (extraction === undefined) {
        throw new Error('Expected lazy descriptor to match benchmark args')
      }
      const plan = cache.getSingle(extraction.cacheKey)!
      const result = await executor.execute({
        plan,
        model: query.modelName,
        operation: query.action,
        placeholderValues: extraction.placeholderValues,
        transaction: undefined,
        batchIndex: undefined,
      })
      const response = {
        data: { [query.action]: result },
        [queryEngineResultDataWasDeserialized]: true,
      }
      consumedResults += response.data[query.action] === undefined ? 0 : 1
    }
    const elapsedMs = performance.now() - started
    const afterHeap = heapUsed()

    if (consumedResults < 0) {
      throw new Error('unreachable')
    }

    return {
      ...scenario,
      query,
      elapsedMs,
      averageUs: (elapsedMs * 1000) / scenario.iterations,
      counts: { ...counts },
      heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
    } satisfies DirectPlanMeasurement
  } finally {
    await executor.disconnect()
  }
}

async function measureManyShapeCachedRequestWrapperScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: ManyShapeCachedRequestScenario,
) {
  const counts: Counts = {
    compile: 0,
    compileBatch: 0,
    queryRaw: 0,
    executeRaw: 0,
  }
  const executor = await LocalExecutor.connect({
    driverAdapterFactory: scenario.adapterFactory?.(counts) ?? createAdapterFactory(counts, scenario.resultSet),
    transactionOptions: {
      maxWait: 2000,
      timeout: 5000,
    },
    tracingHelper: noopTracingHelper,
    provider: 'sqlite',
  })
  const cache = new QueryPlanCache(scenario.shapeCount)
  const shapeQueries = new Array<JsonQuery>(scenario.shapeCount)

  for (let i = 0; i < scenario.shapeCount; i++) {
    const query = scenario.query(i, 0)
    const { parameterizedQuery } = parameterizeQuery(query, paramGraph)
    const queryPart = JSON.stringify(parameterizedQuery.query)
    const cacheKey = getSingleQueryCacheKey(parameterizedQuery, queryPart)
    cache.setSingle(cacheKey, compiler.compile(getSingleQueryRequest(parameterizedQuery, queryPart)))
    shapeQueries[i] = query
  }

  const queries = new Array<JsonQuery>(scenario.iterations)
  for (let i = 0; i < scenario.iterations; i++) {
    queries[i] = scenario.query(i % scenario.shapeCount, i)
  }

  let consumedResults = 0
  try {
    for (let i = 0; i < scenario.iterations; i++) {
      const query = queries[i]
      const { parameterizedQuery, placeholderValues } = parameterizeQuery(query, paramGraph)
      const queryPart = JSON.stringify(parameterizedQuery.query)
      const plan = cache.getSingle(getSingleQueryCacheKey(parameterizedQuery, queryPart))!
      const result = await executor.execute({
        plan,
        model: query.modelName,
        operation: query.action,
        placeholderValues,
        transaction: undefined,
        batchIndex: undefined,
      })
      const response = {
        data: { [query.action]: result },
        [queryEngineResultDataWasDeserialized]: true,
      }
      consumedResults += response.data[query.action] === undefined ? 0 : 1
    }
    resetCounts(counts)

    const beforeHeap = heapUsed()
    const started = performance.now()
    for (let i = 0; i < scenario.iterations; i++) {
      const query = queries[i]
      const { parameterizedQuery, placeholderValues } = parameterizeQuery(query, paramGraph)
      const queryPart = JSON.stringify(parameterizedQuery.query)
      const plan = cache.getSingle(getSingleQueryCacheKey(parameterizedQuery, queryPart))!
      const result = await executor.execute({
        plan,
        model: query.modelName,
        operation: query.action,
        placeholderValues,
        transaction: undefined,
        batchIndex: undefined,
      })
      const response = {
        data: { [query.action]: result },
        [queryEngineResultDataWasDeserialized]: true,
      }
      consumedResults += response.data[query.action] === undefined ? 0 : 1
    }
    const elapsedMs = performance.now() - started
    const afterHeap = heapUsed()

    if (consumedResults < 0 || shapeQueries.length === 0) {
      throw new Error('unreachable')
    }

    return {
      ...scenario,
      query: shapeQueries[0],
      elapsedMs,
      averageUs: (elapsedMs * 1000) / scenario.iterations,
      counts: { ...counts },
      heapDelta: beforeHeap !== undefined && afterHeap !== undefined ? afterHeap - beforeHeap : undefined,
    } satisfies DirectPlanMeasurement
  } finally {
    await executor.disconnect()
  }
}

async function main(): Promise<void> {
  ;(globalThis as any).TARGET_BUILD_TYPE = 'client'

  const dmmf = await getDMMF({ datamodel: BENCHMARK_DATAMODEL })
  const runtimeDataModel = dmmfToRuntimeDataModel(dmmf.datamodel)
  const paramGraphData = buildParamGraph(dmmf)
  const paramGraph = ParamGraph.fromData(paramGraphData, (enumName) => {
    const enumDef = runtimeDataModel.enums[enumName]
    const mapping: Record<string, string> = {}
    for (const value of enumDef?.values ?? []) {
      mapping[value.name] = value.dbName ?? value.name
    }
    return mapping
  })
  const baseConfig: Omit<EngineConfig, 'adapter' | 'queryPlanCacheMaxSize'> = {
    clientVersion: '0.0.0',
    activeProvider: 'sqlite',
    inlineSchema: BENCHMARK_DATAMODEL,
    logEmitter: new EventEmitter() as LogEmitter,
    tracingHelper: disabledTracingHelper,
    transactionOptions: {
      maxWait: 2000,
      timeout: 5000,
    },
    runtimeDataModel,
    parameterizationSchema: buildAndSerializeParamGraph(dmmf),
  }

  const scenarios: Scenario[] = [
    {
      name: 'findUnique value churn / cache disabled',
      iterations: benchmarkIterations(500),
      cacheMaxSize: 0,
      query: (iteration) => createFindUniqueQuery(iteration + 1),
    },
    {
      name: 'findUnique value churn / warmed cache',
      iterations: benchmarkIterations(500),
      cacheMaxSize: 100,
      query: (iteration) => createFindUniqueQuery(iteration + 1),
    },
    {
      name: 'findMany 10 scalar rows / cache disabled',
      iterations: benchmarkIterations(500),
      cacheMaxSize: 0,
      query: () => createFindManyUsersQuery(),
      resultSet: USER_SCALAR_RESULT,
    },
    {
      name: 'findMany 10 scalar rows / warmed cache',
      iterations: benchmarkIterations(500),
      cacheMaxSize: 100,
      query: () => createFindManyUsersQuery(),
      resultSet: USER_SCALAR_RESULT,
    },
    {
      name: 'blog page value churn / cache disabled',
      iterations: benchmarkIterations(500),
      cacheMaxSize: 0,
      query: (iteration) => createBlogPostPageQuery(iteration + 1),
    },
    {
      name: 'blog page value churn / warmed cache',
      iterations: benchmarkIterations(500),
      cacheMaxSize: 100,
      query: (iteration) => createBlogPostPageQuery(iteration + 1),
    },
    {
      name: 'blog page nested rows / warmed cache',
      iterations: benchmarkIterations(500),
      cacheMaxSize: 100,
      query: (iteration) => createBlogPostPageQuery(iteration + 1),
      adapterFactory: createBlogPageAdapterFactory,
    },
  ]
  const generatedClientScenarios: GeneratedClientScenario[] = [
    {
      name: 'generated client findUnique / warmed cache',
      iterations: benchmarkIterations(500),
      query: createFindUniqueQuery(1),
      resultSet: USER_UNIQUE_RESULT,
      operation: (client, iteration) => client.user.findUnique(createGeneratedFindUniqueArgs(iteration)),
    },
    {
      name: 'generated client batched findUnique / warmed cache',
      iterations: benchmarkIterations(500),
      query: createFindUniqueQuery(1),
      resultSet: USER_UNIQUE_RESULT,
      operation: (client, iteration) =>
        Promise.all([
          client.user.findUnique(createGeneratedFindUniqueArgs(iteration * 2)),
          client.user.findUnique(createGeneratedFindUniqueArgs(iteration * 2 + 1)),
        ]),
    },
    {
      name: 'generated client findMany users / warmed cache',
      iterations: benchmarkIterations(500),
      query: createFindManyUsersQuery(),
      resultSet: USER_SCALAR_RESULT,
      operation: (client) => client.user.findMany(createGeneratedFindManyUsersArgs()),
    },
    {
      name: 'generated client blog page / nested rows warmed cache',
      iterations: benchmarkIterations(500),
      query: createBlogPostPageQuery(1),
      adapterFactory: createBlogPageAdapterFactory,
      operation: (client, iteration) => client.post.findUnique(createGeneratedBlogPostPageArgs(iteration)),
    },
    {
      name: 'generated client blog page / 2 alternating nested row shapes warmed cache',
      iterations: benchmarkIterations(500),
      query: createBlogPostPageQuery(1),
      adapterFactory: createBlogPageAdapterFactory,
      operation: (client, iteration) =>
        client.post.findUnique(
          createGeneratedBlogPostPageRootMaskArgs(iteration % 2 === 0 ? 0b1111111 : 0b0000011, iteration),
        ),
    },
  ]
  const generatedClientSerializeScenarios: GeneratedClientSerializeScenario[] = [
    {
      name: 'generated client serialize findUnique / warmed cache',
      iterations: benchmarkIterations(500),
      modelName: 'User',
      action: 'findUnique',
      clientMethod: 'user.findUnique',
      args: createGeneratedFindUniqueArgs,
      query: (iteration) => createFindUniqueQuery(iteration + 1),
      resultSet: USER_UNIQUE_RESULT,
    },
    {
      name: 'generated client serialize findMany users / warmed cache',
      iterations: benchmarkIterations(500),
      modelName: 'User',
      action: 'findMany',
      clientMethod: 'user.findMany',
      args: createGeneratedFindManyUsersArgs,
      query: () => createFindManyUsersQuery(),
      resultSet: USER_SCALAR_RESULT,
    },
    {
      name: 'generated client serialize blog page / nested rows warmed cache',
      iterations: benchmarkIterations(500),
      modelName: 'Post',
      action: 'findUnique',
      clientMethod: 'post.findUnique',
      args: createGeneratedBlogPostPageArgs,
      query: (iteration) => createBlogPostPageQuery(iteration + 1),
      adapterFactory: createBlogPageAdapterFactory,
    },
  ]

  for (const scenario of scenarios.filter((scenario) => shouldRunMeasurement(scenario.name))) {
    printMeasurement(await measureScenario(baseConfig, scenario))
  }

  for (const scenario of generatedClientSerializeScenarios.filter((scenario) => shouldRunMeasurement(scenario.name))) {
    printPlanPhaseMeasurement(measureGeneratedClientSerializeScenario(baseConfig, scenario))
  }

  for (const scenario of generatedClientSerializeScenarios) {
    const measuredScenario = {
      ...scenario,
      name: scenario.name.replace('generated client serialize', 'generated client serialize cache key'),
    }
    if (!shouldRunMeasurement(measuredScenario.name)) {
      continue
    }
    printPlanPhaseMeasurement(measureGeneratedClientSerializeCacheKeyScenario(baseConfig, paramGraph, measuredScenario))
  }

  for (const scenario of generatedClientSerializeScenarios) {
    if (scenario.clientMethod !== 'post.findUnique') {
      continue
    }

    const measuredScenario = {
      ...scenario,
      name: scenario.name.replace('generated client serialize', 'generated client static descriptor extract'),
    }
    if (!shouldRunMeasurement(measuredScenario.name)) {
      continue
    }
    printPlanPhaseMeasurement(
      measureGeneratedBlogPostPageDescriptorExtractScenario(baseConfig, paramGraph, measuredScenario),
    )
  }

  for (const scenario of generatedClientSerializeScenarios) {
    const measuredScenario = {
      ...scenario,
      name: scenario.name.replace('generated client serialize', 'generated client lazy descriptor extract'),
    }
    if (!shouldRunMeasurement(measuredScenario.name)) {
      continue
    }
    printPlanPhaseMeasurement(measureGeneratedLazyDescriptorExtractScenario(baseConfig, paramGraph, measuredScenario))
  }

  for (const scenario of generatedClientSerializeScenarios) {
    const measuredScenario = {
      ...scenario,
      name: scenario.name.replace('generated client serialize', 'internal request precomputed lazy descriptor'),
    }
    if (!shouldRunMeasurement(measuredScenario.name)) {
      continue
    }
    printDirectPlanMeasurement(
      await measureInternalRequestPrecomputedLazyDescriptorScenario(baseConfig, paramGraph, measuredScenario, 'none'),
    )
  }

  for (const scenario of generatedClientSerializeScenarios) {
    const measuredScenario = {
      ...scenario,
      name: scenario.name.replace(
        'generated client serialize',
        'internal request precomputed protocol lazy descriptor',
      ),
    }
    if (!shouldRunMeasurement(measuredScenario.name)) {
      continue
    }
    printDirectPlanMeasurement(
      await measureInternalRequestPrecomputedLazyDescriptorScenario(
        baseConfig,
        paramGraph,
        measuredScenario,
        'dynamic',
      ),
    )
  }

  for (const scenario of generatedClientSerializeScenarios) {
    const measuredScenario = {
      ...scenario,
      name: scenario.name.replace(
        'generated client serialize',
        'internal request precomputed static protocol lazy descriptor',
      ),
    }
    if (!shouldRunMeasurement(measuredScenario.name)) {
      continue
    }
    printDirectPlanMeasurement(
      await measureInternalRequestPrecomputedLazyDescriptorScenario(baseConfig, paramGraph, measuredScenario, 'static'),
    )
  }

  for (const scenario of generatedClientSerializeScenarios) {
    const measuredScenario = {
      ...scenario,
      name: scenario.name.replace(
        'generated client serialize',
        'request handler precomputed static protocol lazy descriptor',
      ),
    }
    if (!shouldRunMeasurement(measuredScenario.name)) {
      continue
    }
    printDirectPlanMeasurement(
      await measurePrecomputedLazyDescriptorRequestSurfaceScenario(
        baseConfig,
        paramGraph,
        measuredScenario,
        'request-handler',
      ),
    )
  }

  for (const scenario of generatedClientSerializeScenarios) {
    const measuredScenario = {
      ...scenario,
      name: scenario.name.replace(
        'generated client serialize',
        'client engine precomputed static protocol lazy descriptor',
      ),
    }
    if (!shouldRunMeasurement(measuredScenario.name)) {
      continue
    }
    printDirectPlanMeasurement(
      await measurePrecomputedLazyDescriptorRequestSurfaceScenario(
        baseConfig,
        paramGraph,
        measuredScenario,
        'client-engine',
      ),
    )
  }

  for (const scenario of generatedClientSerializeScenarios) {
    const measuredScenario = {
      ...scenario,
      name: scenario.name.replace(
        'generated client serialize',
        'client engine cached-result precomputed static protocol lazy descriptor',
      ),
    }
    if (!shouldRunMeasurement(measuredScenario.name)) {
      continue
    }
    printDirectPlanMeasurement(
      await measurePrecomputedLazyDescriptorRequestSurfaceScenario(
        baseConfig,
        paramGraph,
        measuredScenario,
        'client-engine-cached-result',
      ),
    )
  }

  for (const scenario of generatedClientSerializeScenarios) {
    const measuredScenario = {
      ...scenario,
      name: scenario.name.replace(
        'generated client serialize',
        'prisma promise engine precomputed static protocol lazy descriptor',
      ),
    }
    if (!shouldRunMeasurement(measuredScenario.name)) {
      continue
    }
    printDirectPlanMeasurement(
      await measurePrecomputedLazyDescriptorRequestSurfaceScenario(
        baseConfig,
        paramGraph,
        measuredScenario,
        'prisma-promise-engine',
      ),
    )
  }

  for (const scenario of generatedClientScenarios) {
    const measuredScenario = {
      ...scenario,
      name: scenario.name.replace('generated client', 'generated client promise construction'),
    }
    if (!shouldRunMeasurement(measuredScenario.name)) {
      continue
    }
    printDirectPlanMeasurement(await measureGeneratedClientPromiseConstructionScenario(baseConfig, measuredScenario))
  }

  for (const scenario of generatedClientScenarios.filter((scenario) => shouldRunMeasurement(scenario.name))) {
    printDirectPlanMeasurement(await measureGeneratedClientScenario(baseConfig, scenario))
  }

  for (const scenario of generatedClientScenarios) {
    const measuredScenario = {
      ...scenario,
      name: scenario.name.replace('generated client', 'generated client engine precomputed fast path'),
    }
    if (!shouldRunMeasurement(measuredScenario.name)) {
      continue
    }
    printDirectPlanMeasurement(await measureGeneratedClientScenario(baseConfig, measuredScenario, 'engine'))
  }

  for (const scenario of generatedClientScenarios) {
    const measuredScenario = {
      ...scenario,
      name: scenario.name.replace('generated client', 'generated client request precomputed fast path'),
    }
    if (!shouldRunMeasurement(measuredScenario.name)) {
      continue
    }
    printDirectPlanMeasurement(await measureGeneratedClientScenario(baseConfig, measuredScenario, 'request'))
  }

  const descriptorBoundMatcherRegistry = createBenchmarkDescriptorBoundMatcherRegistry()
  for (const scenario of generatedClientScenarios) {
    const measuredScenario = {
      ...scenario,
      name: scenario.name.replace('generated client', 'generated client descriptor-bound static matcher'),
    }
    if (!shouldRunMeasurement(measuredScenario.name)) {
      continue
    }
    printDirectPlanMeasurement(
      await measureGeneratedClientScenario(baseConfig, measuredScenario, 'request', descriptorBoundMatcherRegistry),
    )
  }

  const exactGeneratedUserMatcherRegistry = createExactGeneratedUserDescriptorMatcherRegistry()
  for (const scenario of generatedClientScenarios) {
    if (
      scenario.name !== 'generated client findUnique / warmed cache' &&
      scenario.name !== 'generated client batched findUnique / warmed cache' &&
      scenario.name !== 'generated client findMany users / warmed cache' &&
      scenario.name !== 'generated client blog page / nested rows warmed cache' &&
      scenario.name !== 'generated client blog page / 2 alternating nested row shapes warmed cache'
    ) {
      continue
    }

    const measuredScenario = {
      ...scenario,
      name: scenario.name.replace('generated client', 'generated client exact descriptor helper'),
    }
    if (!shouldRunMeasurement(measuredScenario.name)) {
      continue
    }
    printDirectPlanMeasurement(
      await measureGeneratedClientScenario(baseConfig, measuredScenario, 'request', exactGeneratedUserMatcherRegistry),
    )
  }

  const runtimeExactGeneratedUserMatcherRegistry = createExactDescriptorMatcherRegistry([
    {
      model: 'User',
      action: 'findUnique',
      clientMethod: 'user.findUnique',
      field: 'id',
      valueType: 'number',
      select: ['id', 'email', 'name'],
    },
    {
      model: 'User',
      action: 'findMany',
      clientMethod: 'user.findMany',
      field: 'take',
      valueType: 'number',
      select: ['id', 'email', 'name'],
    },
  ])
  for (const scenario of generatedClientScenarios) {
    if (
      scenario.name !== 'generated client findUnique / warmed cache' &&
      scenario.name !== 'generated client batched findUnique / warmed cache' &&
      scenario.name !== 'generated client findMany users / warmed cache'
    ) {
      continue
    }

    const measuredScenario = {
      ...scenario,
      name: scenario.name.replace('generated client', 'generated client runtime exact descriptor helper'),
    }
    if (!shouldRunMeasurement(measuredScenario.name)) {
      continue
    }
    printDirectPlanMeasurement(
      await measureGeneratedClientScenario(
        baseConfig,
        measuredScenario,
        'request',
        runtimeExactGeneratedUserMatcherRegistry,
      ),
    )
  }

  const QueryCompilerClass = await loadQueryCompiler('sqlite')
  const compiler = new QueryCompilerClass({
    provider: 'sqlite',
    connectionInfo: {
      supportsRelationJoins: false,
    },
    datamodel: BENCHMARK_DATAMODEL,
  })
  const directPlanScenarios: DirectPlanScenario[] = [
    {
      name: 'direct plan findUnique / empty rows',
      iterations: benchmarkIterations(500),
      query: createFindUniqueQuery(1),
    },
    {
      name: 'direct plan findMany / 10 scalar rows',
      iterations: benchmarkIterations(500),
      query: createFindManyUsersQuery(),
      resultSet: USER_SCALAR_RESULT,
    },
    {
      name: 'direct plan blog page / empty rows',
      iterations: benchmarkIterations(500),
      query: createBlogPostPageQuery(1),
    },
    {
      name: 'direct plan blog page / nested rows',
      iterations: benchmarkIterations(500),
      query: createBlogPostPageQuery(1),
      adapterFactory: createBlogPageAdapterFactory,
    },
  ]
  const directPlanScopeScenarios: DirectPlanScopeScenario[] = [
    {
      name: 'direct plan findUnique / value scope churn',
      iterations: benchmarkIterations(500),
      query: (iteration) => createFindUniqueQuery(iteration + 1),
    },
    {
      name: 'direct plan blog page / value scope churn',
      iterations: benchmarkIterations(500),
      query: (iteration) => createBlogPostPageQuery(iteration + 1),
    },
  ]
  const cacheKeyScenarios: CacheKeyScenario[] = [
    {
      name: 'cache hit key findUnique / value churn',
      iterations: benchmarkIterations(500),
      query: (iteration) => createFindUniqueQuery(iteration + 1),
      staticShapePlaceholderValues: (iteration) => ({ '%1': iteration + 1 }),
    },
    {
      name: 'cache hit key findMany / stable query',
      iterations: benchmarkIterations(500),
      query: () => createFindManyUsersQuery(),
      resultSet: USER_SCALAR_RESULT,
    },
    {
      name: 'cache hit key blog page / value churn',
      iterations: benchmarkIterations(500),
      query: (iteration) => createBlogPostPageQuery(iteration + 1),
      staticShapePlaceholderValues: (iteration) => ({ '%1': iteration + 1 }),
    },
  ]
  const cachedRequestWrapperScenarios: CacheKeyScenario[] = [
    ...cacheKeyScenarios,
    {
      name: 'cache hit key blog page / nested rows',
      iterations: benchmarkIterations(500),
      query: (iteration) => createBlogPostPageQuery(iteration + 1),
      staticShapePlaceholderValues: (iteration) => ({ '%1': iteration + 1 }),
      adapterFactory: createBlogPageAdapterFactory,
    },
  ]
  const manyShapeCachedRequestScenarios: ManyShapeCachedRequestScenario[] = [
    {
      name: 'cached request wrapper blog page / 100 retained shapes nested rows',
      iterations: benchmarkIterations(500),
      shapeCount: 100,
      query: (shapeIndex, iteration) => createBlogPostPageRootMaskQuery(shapeIndex + 1, iteration + 1),
      adapterFactory: createBlogPageAdapterFactory,
    },
  ]

  try {
    for (const scenario of cacheKeyScenarios) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('cache hit key', 'parameterize'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printPhaseMeasurement(measureParameterizeScenario(paramGraph, measuredScenario))
    }

    for (const scenario of cacheKeyScenarios) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('cache hit key', 'stringify cache key'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printPhaseMeasurement(measureStringifyCacheKeyScenario(paramGraph, measuredScenario))
    }

    for (const scenario of cacheKeyScenarios.filter((scenario) => shouldRunMeasurement(scenario.name))) {
      printCacheKeyMeasurement(measureCacheKeyScenario(paramGraph, scenario))
    }

    for (const scenario of cacheKeyScenarios) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('cache hit key', 'request as cache key'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printCacheKeyMeasurement(measureRequestAsCacheKeyScenario(paramGraph, measuredScenario))
    }

    for (const scenario of cacheKeyScenarios) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('cache hit key', 'compile prebuilt request'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printPhaseMeasurement(measureCompilePrebuiltRequestScenario(compiler, paramGraph, measuredScenario))
    }

    for (const scenario of cacheKeyScenarios) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('cache hit key', 'compile current miss'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printPhaseMeasurement(measureCompileCurrentMissScenario(compiler, paramGraph, measuredScenario))
    }

    for (const scenario of cachedRequestWrapperScenarios) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('cache hit key', 'cached request wrapper'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printDirectPlanMeasurement(await measureCachedRequestWrapperScenario(compiler, paramGraph, measuredScenario))
    }

    for (const scenario of cachedRequestWrapperScenarios) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('cache hit key', 'cached request wrapper precomputed key'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printDirectPlanMeasurement(
        await measureCachedRequestWrapperPrecomputedKeyScenario(compiler, paramGraph, measuredScenario),
      )
    }

    for (const scenario of cachedRequestWrapperScenarios) {
      if (scenario.staticShapePlaceholderValues === undefined) {
        continue
      }

      const measuredScenario = {
        ...scenario,
        staticShapePlaceholderValues: scenario.staticShapePlaceholderValues,
        name: scenario.name.replace('cache hit key', 'cached request wrapper static shape'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printDirectPlanMeasurement(
        await measureCachedRequestWrapperStaticShapeScenario(compiler, paramGraph, measuredScenario),
      )
    }

    for (const scenario of generatedClientSerializeScenarios) {
      if (scenario.adapterFactory === undefined) {
        continue
      }

      const measuredScenario = {
        ...scenario,
        adapterFactory: scenario.adapterFactory,
        name: scenario.name
          .replace('generated client serialize', 'cached request wrapper static descriptor')
          .replace(' warmed cache', ''),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printDirectPlanMeasurement(
        await measureCachedRequestWrapperGeneratedDescriptorScenario(
          compiler,
          paramGraph,
          baseConfig,
          measuredScenario,
        ),
      )
    }

    for (const scenario of generatedClientSerializeScenarios) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name
          .replace('generated client serialize', 'cached request wrapper lazy descriptor')
          .replace(' / warmed cache', '')
          .replace(' warmed cache', ''),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printDirectPlanMeasurement(
        await measureCachedRequestWrapperLazyDescriptorScenario(compiler, paramGraph, baseConfig, measuredScenario),
      )
    }

    for (const scenario of manyShapeCachedRequestScenarios.filter((scenario) => shouldRunMeasurement(scenario.name))) {
      printDirectPlanMeasurement(await measureManyShapeCachedRequestWrapperScenario(compiler, paramGraph, scenario))
    }

    for (const scenario of directPlanScenarios.filter((scenario) => shouldRunMeasurement(scenario.name))) {
      printDirectPlanMeasurement(await measureDirectPlanScenario(compiler, paramGraph, scenario))
    }

    if (shouldRunMeasurement('adapter queryRaw blog page result sets / nested rows')) {
      printPlanPhaseMeasurement(await measureBlogPageAdapterOnlyScenario(benchmarkIterations(500)))
    }
    if (shouldRunMeasurement('serializeSql blog page result sets / nested rows')) {
      printPlanPhaseMeasurement(measureBlogPageSerializeSqlScenario(benchmarkIterations(500)))
    }
    if (shouldRunMeasurement('raw result-set blog page assembly / nested rows')) {
      printPlanPhaseMeasurement(measureRawResultSetBlogPageAssemblyScenario(benchmarkIterations(500)))
    }

    for (const scenario of directPlanScenarios.filter((scenario) => scenario.adapterFactory !== undefined)) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('direct plan', 'raw result-set prototype'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printDirectPlanMeasurement(
        await measureRawResultSetBlogPagePrototypeScenario(compiler, paramGraph, measuredScenario),
      )
    }

    for (const scenario of directPlanScenarios.filter((scenario) => scenario.adapterFactory !== undefined)) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('direct plan', 'raw result-set exact prototype'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printDirectPlanMeasurement(
        await measureRawResultSetBlogPageExactPrototypeScenario(compiler, paramGraph, measuredScenario),
      )
    }

    for (const scenario of directPlanScenarios.filter((scenario) => scenario.adapterFactory !== undefined)) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('direct plan', 'raw result-set direct assembler'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printDirectPlanMeasurement(
        await measureRawResultSetBlogPageDirectAssemblerScenario(compiler, paramGraph, measuredScenario),
      )
    }

    for (const scenario of directPlanScenarios.filter((scenario) => scenario.adapterFactory !== undefined)) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('direct plan', 'raw result-set writer program'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printDirectPlanMeasurement(
        await measureRawResultSetBlogPageWriterProgramScenario(compiler, paramGraph, measuredScenario),
      )
    }

    for (const scenario of directPlanScenarios.filter((scenario) => scenario.adapterFactory !== undefined)) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('direct plan', 'raw result-set static-wave writer program'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printDirectPlanMeasurement(
        await measureRawResultSetBlogPageWriterProgramScenario(compiler, paramGraph, measuredScenario, true),
      )
    }

    for (const scenario of directPlanScenarios.filter((scenario) => scenario.adapterFactory !== undefined)) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('direct plan', 'raw result-set compact node'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printDirectPlanMeasurement(await measureRawResultSetCompactNodeScenario(compiler, paramGraph, measuredScenario))
    }

    for (const scenario of directPlanScenarios.filter((scenario) => scenario.adapterFactory !== undefined)) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('direct plan', 'raw result-set exact compact node'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printDirectPlanMeasurement(
        await measureRawResultSetCompactNodeScenario(compiler, paramGraph, measuredScenario, true),
      )
    }

    for (const scenario of directPlanScenarios.filter((scenario) => scenario.adapterFactory !== undefined)) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('direct plan', 'precomputed query leaves'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      if (scenarioCompilesToRawNestedRead(compiler, paramGraph, scenario)) {
        continue
      }
      printPlanPhaseMeasurement(await measurePrecomputedQueryLeavesScenario(compiler, paramGraph, measuredScenario))
    }

    for (const scenario of directPlanScenarios.filter((scenario) => scenario.adapterFactory !== undefined)) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('direct plan', 'precomputed join leaves'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      if (scenarioCompilesToRawNestedRead(compiler, paramGraph, scenario)) {
        continue
      }
      printPlanPhaseMeasurement(await measurePrecomputedJoinLeavesScenario(compiler, paramGraph, measuredScenario))
    }

    for (const scenario of directPlanScenarios.filter((scenario) => scenario.adapterFactory !== undefined)) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('direct plan', 'precomputed root join children'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      if (scenarioCompilesToRawNestedRead(compiler, paramGraph, scenario)) {
        continue
      }
      printPlanPhaseMeasurement(
        await measurePrecomputedRootJoinChildrenScenario(compiler, paramGraph, measuredScenario),
      )
    }

    for (const scenario of directPlanScenarios.filter((scenario) => scenario.adapterFactory !== undefined)) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('direct plan', 'precomputed root join child branch'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      if (scenarioCompilesToRawNestedRead(compiler, paramGraph, scenario)) {
        continue
      }
      const measurements = await measurePrecomputedRootJoinChildBranchScenarios(compiler, paramGraph, measuredScenario)
      for (const measurement of measurements.filter((measurement) => shouldRunMeasurement(measurement.name))) {
        printPlanPhaseMeasurement(measurement)
      }
    }

    for (const scenario of directPlanScenarios.filter((scenario) => scenario.adapterFactory !== undefined)) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('direct plan', 'inner plan'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      if (scenarioCompilesToRawNestedRead(compiler, paramGraph, scenario)) {
        continue
      }
      printDirectPlanMeasurement(await measureInnerPlanScenario(compiler, paramGraph, measuredScenario))
    }

    for (const scenario of directPlanScenarios.filter((scenario) => scenario.adapterFactory !== undefined)) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('direct plan', 'outer data map'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      if (scenarioCompilesToRawNestedRead(compiler, paramGraph, scenario)) {
        continue
      }
      printPlanPhaseMeasurement(await measureOuterDataMapScenario(compiler, paramGraph, measuredScenario))
    }

    for (const scenario of directPlanScenarios.filter((scenario) => scenario.adapterFactory !== undefined)) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('direct plan', 'interpreter get precomputed'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      if (scenarioCompilesToRawNestedRead(compiler, paramGraph, scenario)) {
        continue
      }
      printPlanPhaseMeasurement(await measureInterpreterGetPrecomputedScenario(compiler, paramGraph, measuredScenario))
    }

    for (const scenario of directPlanScenarios.filter((scenario) => scenario.adapterFactory !== undefined)) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('direct plan', 'interpreter unit'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printPlanPhaseMeasurement(await measureInterpreterUnitScenario(measuredScenario))
    }

    for (const scenario of directPlanScenarios.filter((scenario) => scenario.adapterFactory !== undefined)) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('direct plan', 'interpreter data map precomputed'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      if (scenarioCompilesToRawNestedRead(compiler, paramGraph, scenario)) {
        continue
      }
      printPlanPhaseMeasurement(
        await measureInterpreterDataMapPrecomputedScenario(compiler, paramGraph, measuredScenario),
      )
    }

    for (const scenario of directPlanScenarios.filter((scenario) => scenario.adapterFactory !== undefined)) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('direct plan', 'manual inner+outer'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      if (scenarioCompilesToRawNestedRead(compiler, paramGraph, scenario)) {
        continue
      }
      printDirectPlanMeasurement(await measureManualInnerOuterDataMapScenario(compiler, paramGraph, measuredScenario))
    }

    for (const scenario of directPlanScenarios.filter((scenario) => scenario.adapterFactory !== undefined)) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('direct plan', 'direct plan after phase warmup'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printDirectPlanMeasurement(await measureDirectPlanScenario(compiler, paramGraph, measuredScenario))
    }

    for (const scenario of directPlanScopeScenarios.filter((scenario) => shouldRunMeasurement(scenario.name))) {
      printDirectPlanMeasurement(await measureDirectPlanScopeScenario(compiler, paramGraph, scenario))
    }

    for (const scenario of directPlanScopeScenarios) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('direct plan', 'render query'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printPlanPhaseMeasurement(measureRenderQueryScopeScenario(compiler, paramGraph, measuredScenario))
    }

    for (const scenario of directPlanScenarios.filter((scenario) => scenario.adapterFactory !== undefined)) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('direct plan', 'render query all leaves'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printPlanPhaseMeasurement(measureRenderBlogPageQueriesScenario(compiler, paramGraph, measuredScenario))
    }

    for (const scenario of directPlanScenarios.filter((scenario) => scenario.adapterFactory === undefined)) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('direct plan', 'data map'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printPlanPhaseMeasurement(measureDataMapScenario(compiler, paramGraph, measuredScenario))
    }

    for (const scenario of directPlanScenarios) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('direct plan', 'local executor'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printDirectPlanMeasurement(await measureLocalExecutorScenario(compiler, paramGraph, measuredScenario))
    }

    for (const scenario of directPlanScopeScenarios) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('direct plan', 'local executor'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printDirectPlanMeasurement(await measureLocalExecutorScopeScenario(compiler, paramGraph, measuredScenario))
    }

    for (const scenario of scenarios.filter((scenario) => scenario.name === 'blog page nested rows / warmed cache')) {
      const measuredScenario = {
        ...scenario,
        name: 'blog page nested rows / warmed cache after phase warmup',
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
        continue
      }
      printMeasurement(await measureScenario(baseConfig, measuredScenario))
    }
  } finally {
    compiler.free()
  }
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
