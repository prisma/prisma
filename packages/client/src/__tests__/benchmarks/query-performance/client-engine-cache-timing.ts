import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'

import {
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
  getQueryPlanBindingExpr,
  getQueryPlanBindingName,
  noopTracingHelper,
  parameterizeQuery,
  QueryInterpreter,
  type QueryPlanBinding,
  type QueryPlanCompactNode,
  type QueryPlanDbQuery,
  type QueryPlanNode,
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
import { disabledTracingHelper } from '../../../runtime/core/tracing/TracingHelper'
import { loadQueryCompiler } from './qc-loader'

const BENCHMARK_DATAMODEL = fs.readFileSync(path.join(__dirname, 'schema.prisma'), 'utf-8')
const MEASUREMENT_FILTER = process.env.CLIENT_ENGINE_CACHE_TIMING_FILTER
const ITERATION_OVERRIDE =
  process.env.CLIENT_ENGINE_CACHE_TIMING_ITERATIONS === undefined
    ? undefined
    : Number.parseInt(process.env.CLIENT_ENGINE_CACHE_TIMING_ITERATIONS, 10)
const EMPTY_RESULT: SqlResultSet = Object.freeze({
  columnNames: [],
  columnTypes: [],
  rows: [],
})
const USER_SCALAR_RESULT: SqlResultSet = Object.freeze({
  columnNames: Object.freeze(['id', 'email', 'name']),
  columnTypes: Object.freeze([ColumnTypeEnum.Int32, ColumnTypeEnum.Text, ColumnTypeEnum.Text]) as ColumnType[],
  rows: Object.freeze(
    Array.from({ length: 10 }, (_, index) =>
      Object.freeze([index + 1, `user${index + 1}@example.test`, `User ${index + 1}`]),
    ),
  ) as unknown[][],
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
    return Promise.resolve(getBlogPageResultSet(query.sql))
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
        return cacheBlogPageResultSet(sql, BLOG_PAGE_POST_RESULT)
      case 'Category':
        return cacheBlogPageResultSet(sql, BLOG_PAGE_CATEGORY_RESULT)
      case 'PostTag':
        return cacheBlogPageResultSet(sql, BLOG_PAGE_POST_TAG_RESULT)
      case 'Tag':
        return cacheBlogPageResultSet(sql, BLOG_PAGE_TAG_RESULT)
      case 'Comment':
        return cacheBlogPageResultSet(sql, BLOG_PAGE_COMMENT_RESULT)
      case 'User':
        return cacheBlogPageResultSet(
          sql,
          sql.includes(' IN ') ? BLOG_PAGE_COMMENT_AUTHOR_RESULT : BLOG_PAGE_AUTHOR_RESULT,
        )
    }
  }

  throw new Error(`Unexpected blog page benchmark SQL: ${sql}`)
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

function resetCounts(counts: Counts): void {
  counts.compile = 0
  counts.compileBatch = 0
  counts.queryRaw = 0
  counts.executeRaw = 0
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

function compileDirectPlan(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  query: JsonQuery,
): { plan: QueryPlanNode; placeholderValues: Record<string, unknown> } {
  const { parameterizedQuery, placeholderValues } = parameterizeQuery(query, paramGraph)
  const queryPart = JSON.stringify(parameterizedQuery.query)
  return {
    plan: compiler.compile(getSingleQueryRequest(parameterizedQuery, queryPart)),
    placeholderValues,
  }
}

function getRootDataMapPlan(plan: QueryPlanNode): DirectDataMapPlan {
  if (isCompactPlanNode(plan)) {
    if (plan[0] !== 'd') {
      throw new Error(`Expected compact dataMap plan, got ${plan[0]}`)
    }

    return {
      expr: plan[1],
      structure: plan[2],
      enums: plan[3],
    }
  }

  if (plan.type !== 'dataMap') {
    throw new Error(`Expected dataMap plan, got ${plan.type}`)
  }

  return {
    expr: plan.args.expr as QueryPlanNode,
    structure: plan.args.structure,
    enums: plan.args.enums,
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

function collectDbQueries(plan: QueryPlanNode | undefined, dbQueries: QueryPlanDbQuery[]): void {
  if (plan === undefined) {
    return
  }

  if (isCompactPlanNode(plan)) {
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

  switch (plan.type) {
    case 'query':
    case 'execute':
      dbQueries.push(plan.args)
      return

    case 'unique':
    case 'required':
    case 'reverse':
    case 'transaction':
      collectDbQueries(plan.args, dbQueries)
      return

    case 'dataMap':
    case 'validate':
    case 'process':
    case 'mapRecord':
      collectDbQueries(plan.args.expr, dbQueries)
      return

    case 'mapField':
      collectDbQueries(plan.args.records, dbQueries)
      return

    case 'if':
      collectDbQueries(plan.args.value, dbQueries)
      collectDbQueries(plan.args.then, dbQueries)
      collectDbQueries(plan.args.else, dbQueries)
      return

    case 'join':
      collectDbQueries(plan.args.parent, dbQueries)
      for (const join of plan.args.children) {
        collectDbQueries('child' in join ? join.child : join[0], dbQueries)
      }
      return

    case 'seq':
    case 'sum':
    case 'concat':
      for (const child of plan.args) {
        collectDbQueries(child, dbQueries)
      }
      return

    case 'let':
      for (const binding of plan.args.bindings) {
        collectDbQueries('expr' in binding ? binding.expr : binding[1], dbQueries)
      }
      collectDbQueries(plan.args.expr, dbQueries)
      return

    case 'value':
    case 'get':
    case 'getFirstNonEmpty':
    case 'unit':
      return

    default:
      throw new Error(`Expected query plan with DB queries, got ${plan['type']}`)
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

function findFirstDbQuery(plan: QueryPlanNode | undefined): QueryPlanDbQuery | undefined {
  if (plan === undefined) {
    return undefined
  }

  if (isCompactPlanNode(plan)) {
    switch (plan[0]) {
      case 'q':
      case 'x':
        return plan[1]

      case 'd':
      case 'm':
      case 'p':
      case 'r':
      case 'R':
      case 't':
      case 'u':
        return findFirstDbQuery(plan[1])

      case 'j':
        return findFirstDbQuery(plan[1]) ?? findFirstDbQueryInCompactJoins(plan[2] as CompactJoinExpression[])

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

  switch (plan.type) {
    case 'query':
    case 'execute':
      return plan.args

    case 'unique':
    case 'required':
    case 'reverse':
    case 'transaction':
      return findFirstDbQuery(plan.args)

    case 'join':
      return (
        findFirstDbQuery(plan.args.parent) ??
        plan.args.children.reduce<QueryPlanDbQuery | undefined>(
          (found, join) => found ?? findFirstDbQuery('child' in join ? join.child : join[0]),
          undefined,
        )
      )

    case 'dataMap':
    case 'validate':
    case 'process':
    case 'mapRecord':
      return findFirstDbQuery(plan.args.expr)

    case 'mapField':
      return findFirstDbQuery(plan.args.records)

    case 'if':
      return findFirstDbQuery(plan.args.value) ?? findFirstDbQuery(plan.args.then) ?? findFirstDbQuery(plan.args.else)

    case 'seq':
    case 'sum':
    case 'concat':
      for (const child of plan.args) {
        const dbQuery = findFirstDbQuery(child)
        if (dbQuery !== undefined) {
          return dbQuery
        }
      }
      return undefined

    case 'let':
      for (const binding of plan.args.bindings) {
        const dbQuery = findFirstDbQuery('expr' in binding ? binding.expr : binding[1])
        if (dbQuery !== undefined) {
          return dbQuery
        }
      }
      return findFirstDbQuery(plan.args.expr)

    case 'value':
    case 'get':
    case 'getFirstNonEmpty':
    case 'unit':
      return undefined

    default:
      throw new Error(`Expected query plan with a DB query, got ${plan['type']}`)
  }
}

function isObjectResultNode(structure: ResultNode): boolean {
  return (
    Array.isArray(structure) || (typeof structure === 'object' && structure !== null && structure.type === 'object')
  )
}

function isCompactPlanNode(plan: QueryPlanNode): plan is QueryPlanCompactNode {
  return Array.isArray(plan)
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

  for (const scenario of scenarios.filter((scenario) => shouldRunMeasurement(scenario.name))) {
    printMeasurement(await measureScenario(baseConfig, scenario))
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
    },
  ]
  const cachedRequestWrapperScenarios: CacheKeyScenario[] = [
    ...cacheKeyScenarios,
    {
      name: 'cache hit key blog page / nested rows',
      iterations: benchmarkIterations(500),
      query: (iteration) => createBlogPostPageQuery(iteration + 1),
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

    for (const scenario of directPlanScenarios.filter((scenario) => scenario.adapterFactory !== undefined)) {
      const measuredScenario = {
        ...scenario,
        name: scenario.name.replace('direct plan', 'precomputed query leaves'),
      }
      if (!shouldRunMeasurement(measuredScenario.name)) {
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
