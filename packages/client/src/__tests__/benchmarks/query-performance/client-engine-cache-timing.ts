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
import {
  type CompactJoinExpression,
  getQueryPlanBindingExpr,
  noopTracingHelper,
  parameterizeQuery,
  QueryInterpreter,
  type QueryPlanBinding,
  type QueryPlanCompactNode,
  type QueryPlanDbQuery,
  type QueryPlanNode,
  type ResultNode,
} from '@prisma/client-engine-runtime'
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

import { applyDataMapToResultSet } from '../../../../../client-engine-runtime/src/interpreter/data-mapper'
import type { GeneratorRegistrySnapshot } from '../../../../../client-engine-runtime/src/interpreter/generators'
import { renderQuery } from '../../../../../client-engine-runtime/src/interpreter/render-query'
import { ClientEngine } from '../../../runtime/core/engines/client/ClientEngine'
import { LocalExecutor } from '../../../runtime/core/engines/client/LocalExecutor'
import { QueryPlanCache } from '../../../runtime/core/engines/client/query-plan-cache'
import type { EngineConfig } from '../../../runtime/core/engines/common/Engine'
import type { LogEmitter } from '../../../runtime/core/engines/common/types/Events'
import { queryEngineResultDataWasDeserialized } from '../../../runtime/core/engines/common/types/QueryEngine'
import { disabledTracingHelper } from '../../../runtime/core/tracing/TracingHelper'
import { loadQueryCompiler } from './qc-loader'

const BENCHMARK_DATAMODEL = fs.readFileSync(path.join(__dirname, 'schema.prisma'), 'utf-8')
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

type Counts = {
  compile: number
  compileBatch: number
  queryRaw: number
  executeRaw: number
}

type Scenario = {
  name: string
  iterations: number
  query: (iteration: number) => JsonQuery
  cacheMaxSize: number
  resultSet?: SqlResultSet
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
}

type DirectPlanScopeScenario = {
  name: string
  iterations: number
  query: (iteration: number) => JsonQuery
  resultSet?: SqlResultSet
}

type CacheKeyScenario = {
  name: string
  iterations: number
  query: (iteration: number) => JsonQuery
  resultSet?: SqlResultSet
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

function createAdapterFactory(counts: Counts, resultSet?: SqlResultSet): SqlDriverAdapterFactory {
  return {
    provider: 'sqlite',
    adapterName: '@prisma/adapter-benchmark-empty',
    connect: () => Promise.resolve(new EmptySqliteAdapter(counts, resultSet)),
  }
}

function createAdapter(counts: Counts, resultSet?: SqlResultSet): EmptySqliteAdapter {
  return new EmptySqliteAdapter(counts, resultSet)
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

function createBlogPostPageQuery(id: number): JsonQuery {
  return {
    modelName: 'Post',
    action: 'findUnique',
    query: {
      arguments: {
        where: { id },
      },
      selection: {
        id: true,
        title: true,
        slug: true,
        content: true,
        published: true,
        viewCount: true,
        createdAt: true,
        author: {
          selection: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        category: {
          selection: {
            id: true,
            name: true,
            slug: true,
          },
        },
        tags: {
          selection: {
            tag: {
              selection: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        comments: {
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
        },
        _count: {
          selection: {
            likes: true,
            comments: true,
          },
        },
      },
    },
  }
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
      adapter: createAdapterFactory(counts, scenario.resultSet),
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
      structure: plan[2],
      enums: plan[3],
    }
  }

  if (plan.type !== 'dataMap') {
    throw new Error(`Expected dataMap plan, got ${plan.type}`)
  }

  return {
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
  const adapter = createAdapter(counts, scenario.resultSet)
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
  const adapter = createAdapter(counts, scenario.resultSet)
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
    driverAdapterFactory: createAdapterFactory(counts, scenario.resultSet),
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
    driverAdapterFactory: createAdapterFactory(counts, scenario.resultSet),
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
    driverAdapterFactory: createAdapterFactory(counts, scenario.resultSet),
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
      iterations: 500,
      cacheMaxSize: 0,
      query: (iteration) => createFindUniqueQuery(iteration + 1),
    },
    {
      name: 'findUnique value churn / warmed cache',
      iterations: 500,
      cacheMaxSize: 100,
      query: (iteration) => createFindUniqueQuery(iteration + 1),
    },
    {
      name: 'findMany 10 scalar rows / cache disabled',
      iterations: 500,
      cacheMaxSize: 0,
      query: () => createFindManyUsersQuery(),
      resultSet: USER_SCALAR_RESULT,
    },
    {
      name: 'findMany 10 scalar rows / warmed cache',
      iterations: 500,
      cacheMaxSize: 100,
      query: () => createFindManyUsersQuery(),
      resultSet: USER_SCALAR_RESULT,
    },
    {
      name: 'blog page value churn / cache disabled',
      iterations: 500,
      cacheMaxSize: 0,
      query: (iteration) => createBlogPostPageQuery(iteration + 1),
    },
    {
      name: 'blog page value churn / warmed cache',
      iterations: 500,
      cacheMaxSize: 100,
      query: (iteration) => createBlogPostPageQuery(iteration + 1),
    },
  ]

  for (const scenario of scenarios) {
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
      iterations: 500,
      query: createFindUniqueQuery(1),
    },
    {
      name: 'direct plan findMany / 10 scalar rows',
      iterations: 500,
      query: createFindManyUsersQuery(),
      resultSet: USER_SCALAR_RESULT,
    },
    {
      name: 'direct plan blog page / empty rows',
      iterations: 500,
      query: createBlogPostPageQuery(1),
    },
  ]
  const directPlanScopeScenarios: DirectPlanScopeScenario[] = [
    {
      name: 'direct plan findUnique / value scope churn',
      iterations: 500,
      query: (iteration) => createFindUniqueQuery(iteration + 1),
    },
    {
      name: 'direct plan blog page / value scope churn',
      iterations: 500,
      query: (iteration) => createBlogPostPageQuery(iteration + 1),
    },
  ]
  const cacheKeyScenarios: CacheKeyScenario[] = [
    {
      name: 'cache hit key findUnique / value churn',
      iterations: 500,
      query: (iteration) => createFindUniqueQuery(iteration + 1),
    },
    {
      name: 'cache hit key findMany / stable query',
      iterations: 500,
      query: () => createFindManyUsersQuery(),
      resultSet: USER_SCALAR_RESULT,
    },
    {
      name: 'cache hit key blog page / value churn',
      iterations: 500,
      query: (iteration) => createBlogPostPageQuery(iteration + 1),
    },
  ]

  try {
    for (const scenario of cacheKeyScenarios) {
      printPhaseMeasurement(
        measureParameterizeScenario(paramGraph, {
          ...scenario,
          name: scenario.name.replace('cache hit key', 'parameterize'),
        }),
      )
    }

    for (const scenario of cacheKeyScenarios) {
      printPhaseMeasurement(
        measureStringifyCacheKeyScenario(paramGraph, {
          ...scenario,
          name: scenario.name.replace('cache hit key', 'stringify cache key'),
        }),
      )
    }

    for (const scenario of cacheKeyScenarios) {
      printCacheKeyMeasurement(measureCacheKeyScenario(paramGraph, scenario))
    }

    for (const scenario of cacheKeyScenarios) {
      printDirectPlanMeasurement(
        await measureCachedRequestWrapperScenario(compiler, paramGraph, {
          ...scenario,
          name: scenario.name.replace('cache hit key', 'cached request wrapper'),
        }),
      )
    }

    for (const scenario of directPlanScenarios) {
      printDirectPlanMeasurement(await measureDirectPlanScenario(compiler, paramGraph, scenario))
    }

    for (const scenario of directPlanScopeScenarios) {
      printDirectPlanMeasurement(await measureDirectPlanScopeScenario(compiler, paramGraph, scenario))
    }

    for (const scenario of directPlanScopeScenarios) {
      printPlanPhaseMeasurement(
        measureRenderQueryScopeScenario(compiler, paramGraph, {
          ...scenario,
          name: scenario.name.replace('direct plan', 'render query'),
        }),
      )
    }

    for (const scenario of directPlanScenarios) {
      printPlanPhaseMeasurement(
        measureDataMapScenario(compiler, paramGraph, {
          ...scenario,
          name: scenario.name.replace('direct plan', 'data map'),
        }),
      )
    }

    for (const scenario of directPlanScenarios) {
      printDirectPlanMeasurement(
        await measureLocalExecutorScenario(compiler, paramGraph, {
          ...scenario,
          name: scenario.name.replace('direct plan', 'local executor'),
        }),
      )
    }

    for (const scenario of directPlanScopeScenarios) {
      printDirectPlanMeasurement(
        await measureLocalExecutorScopeScenario(compiler, paramGraph, {
          ...scenario,
          name: scenario.name.replace('direct plan', 'local executor'),
        }),
      )
    }
  } finally {
    compiler.free()
  }
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
