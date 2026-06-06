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
import { buildAndSerializeParamGraph } from '@prisma/param-graph-builder'

import { ClientEngine } from '../../../runtime/core/engines/client/ClientEngine'
import type { EngineConfig } from '../../../runtime/core/engines/common/Engine'
import type { LogEmitter } from '../../../runtime/core/engines/common/types/Events'
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

    const beforeHeap = heapUsed()
    const started = performance.now()
    for (let i = 0; i < scenario.iterations; i++) {
      await engine.request(scenario.query(i), {
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

async function main(): Promise<void> {
  ;(globalThis as any).TARGET_BUILD_TYPE = 'client'

  const dmmf = await getDMMF({ datamodel: BENCHMARK_DATAMODEL })
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
    runtimeDataModel: dmmfToRuntimeDataModel(dmmf.datamodel),
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
      name: 'findUnique value churn / cache enabled',
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
      name: 'findMany 10 scalar rows / cache enabled',
      iterations: 500,
      cacheMaxSize: 100,
      query: () => createFindManyUsersQuery(),
      resultSet: USER_SCALAR_RESULT,
    },
    {
      name: 'blog page value churn / cache disabled',
      iterations: 200,
      cacheMaxSize: 0,
      query: (iteration) => createBlogPostPageQuery(iteration + 1),
    },
    {
      name: 'blog page value churn / cache enabled',
      iterations: 200,
      cacheMaxSize: 100,
      query: (iteration) => createBlogPostPageQuery(iteration + 1),
    },
  ]

  for (const scenario of scenarios) {
    printMeasurement(await measureScenario(baseConfig, scenario))
  }
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
