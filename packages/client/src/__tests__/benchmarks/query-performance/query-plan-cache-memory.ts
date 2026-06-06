import fs from 'node:fs'
import path from 'node:path'

import { dmmfToRuntimeDataModel, type QueryCompiler } from '@prisma/client-common'
import { parameterizeQuery, type QueryPlanNode } from '@prisma/client-engine-runtime'
import { getDMMF } from '@prisma/client-generator-js'
import type { JsonQuery } from '@prisma/json-protocol'
import type { ParamGraph } from '@prisma/param-graph'
import { ParamGraph as ParamGraphClass } from '@prisma/param-graph'
import { buildParamGraph } from '@prisma/param-graph-builder'

import { QueryPlanCache } from '../../../runtime/core/engines/client/query-plan-cache'
import { loadQueryCompiler } from './qc-loader'

const BENCHMARK_DATAMODEL = fs.readFileSync(path.join(__dirname, 'schema.prisma'), 'utf-8')
const USER_SCALAR_FIELDS = [
  'id',
  'email',
  'name',
  'username',
  'bio',
  'avatar',
  'isActive',
  'role',
  'createdAt',
  'updatedAt',
] as const
const POST_SCALAR_FIELDS = [
  'id',
  'title',
  'slug',
  'content',
  'excerpt',
  'published',
  'featured',
  'viewCount',
  'authorId',
  'categoryId',
  'createdAt',
  'updatedAt',
  'publishedAt',
] as const

type ScenarioKind = 'user-scalar-selection' | 'blog-page'

type Scenario = {
  name: string
  kind: ScenarioKind
  maxSize: number
  compileCount: number
  parameterized?: boolean
}

type Measurement = Scenario & {
  retainedEntries: number
  heapDelta: number
  retainedCacheKeyBytes: number
  retainedPlanSerializedBytes: number
}

type RetainedSize = {
  cacheKeyBytes: number
  planSerializedBytes: number
}

type CompiledScenarioQuery = RetainedSize & {
  cacheKey: string
  plan: QueryPlanNode
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

function getSingleQueryRequest(query: JsonQuery, queryPart: string): string {
  const actionPart = JSON.stringify(query.action)

  if (query.modelName === undefined) {
    return `{"action":${actionPart},"query":${queryPart}}`
  }

  return `{"modelName":${JSON.stringify(query.modelName)},"action":${actionPart},"query":${queryPart}}`
}

function createFindManyQuery(mask: number): JsonQuery {
  const selection: Record<string, true> = {}

  for (let i = 0; i < USER_SCALAR_FIELDS.length; i++) {
    if ((mask & (1 << i)) !== 0) {
      selection[USER_SCALAR_FIELDS[i]] = true
    }
  }

  return {
    modelName: 'User',
    action: 'findMany',
    query: {
      selection,
    },
  }
}

function createBlogPostPageQuery(mask: number): JsonQuery {
  const selection: Record<string, unknown> = {}

  for (let i = 0; i < POST_SCALAR_FIELDS.length; i++) {
    if ((mask & (1 << i)) !== 0) {
      selection[POST_SCALAR_FIELDS[i]] = true
    }
  }

  if (Object.keys(selection).length === 0) {
    selection.id = true
  }

  selection.author = {
    selection: {
      id: true,
      name: true,
      avatar: true,
    },
  }
  selection.category = {
    selection: {
      $scalars: true,
    },
  }
  selection.tags = {
    selection: {
      tag: {
        selection: {
          $scalars: true,
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
      $scalars: true,
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

  return {
    modelName: 'Post',
    action: 'findUnique',
    query: {
      arguments: { where: { id: 1 } },
      selection,
    },
  }
}

function createScenarioQuery(scenario: Scenario, iteration: number): JsonQuery {
  switch (scenario.kind) {
    case 'user-scalar-selection':
      return createFindManyQuery((iteration % 1023) + 1)
    case 'blog-page':
      return createBlogPostPageQuery((iteration % ((1 << POST_SCALAR_FIELDS.length) - 1)) + 1)
  }
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

function forceGc(): void {
  const gc = (globalThis as typeof globalThis & { gc?: () => void }).gc
  if (typeof gc !== 'function') {
    throw new Error(
      'Run this probe with `node --expose-gc --import tsx packages/client/src/__tests__/benchmarks/query-performance/query-plan-cache-memory.ts`.',
    )
  }

  for (let i = 0; i < 5; i++) {
    gc()
  }
}

function heapUsed(): number {
  forceGc()
  return process.memoryUsage().heapUsed
}

function retainedSerializedSize(retainedSizes: RetainedSize[]): RetainedSize {
  let cacheKeyBytes = 0
  let planSerializedBytes = 0

  for (let i = 0; i < retainedSizes.length; i++) {
    cacheKeyBytes += retainedSizes[i].cacheKeyBytes
    planSerializedBytes += retainedSizes[i].planSerializedBytes
  }

  return { cacheKeyBytes, planSerializedBytes }
}

function compileScenarioQuery(
  compiler: QueryCompiler,
  query: JsonQuery,
  paramGraph: ParamGraph,
  parameterized: boolean,
): CompiledScenarioQuery {
  const cacheQuery = parameterized ? parameterizeQuery(query, paramGraph).parameterizedQuery : query
  const queryPart = JSON.stringify(cacheQuery.query)
  const request = getSingleQueryRequest(cacheQuery, queryPart)
  const cacheKey = getSingleQueryCacheKey(cacheQuery, queryPart)
  const plan = compiler.compile(request)

  return {
    cacheKey,
    cacheKeyBytes: cacheKey.length,
    planSerializedBytes: JSON.stringify(plan).length,
    plan,
  }
}

function measureScenario(compiler: QueryCompiler, paramGraph: ParamGraph, scenario: Scenario): Measurement {
  const cache = new QueryPlanCache(scenario.maxSize)
  const retainedSizes: RetainedSize[] = []
  const before = heapUsed()

  for (let i = 0; i < scenario.compileCount; i++) {
    const query = createScenarioQuery(scenario, i)
    const { cacheKey, cacheKeyBytes, planSerializedBytes, plan } = compileScenarioQuery(
      compiler,
      query,
      paramGraph,
      scenario.parameterized === true,
    )

    cache.setSingle(cacheKey, plan)

    if (scenario.maxSize > 0) {
      retainedSizes.push({
        cacheKeyBytes,
        planSerializedBytes,
      })
      while (retainedSizes.length > scenario.maxSize) {
        retainedSizes.shift()
      }
    }
  }

  const after = heapUsed()
  const retainedSerialized = retainedSerializedSize(retainedSizes)
  const measurement = {
    ...scenario,
    retainedEntries: cache.singleCacheSize,
    heapDelta: after - before,
    retainedCacheKeyBytes: retainedSerialized.cacheKeyBytes,
    retainedPlanSerializedBytes: retainedSerialized.planSerializedBytes,
  }

  cache.clear()
  forceGc()

  return measurement
}

function printMeasurement(measurement: Measurement): void {
  const heapPerEntry =
    measurement.retainedEntries === 0 ? 0 : Math.round(measurement.heapDelta / measurement.retainedEntries)
  const serializedPerEntry =
    measurement.retainedEntries === 0
      ? 0
      : Math.round(
          (measurement.retainedCacheKeyBytes + measurement.retainedPlanSerializedBytes) / measurement.retainedEntries,
        )
  const keyShare =
    measurement.retainedCacheKeyBytes + measurement.retainedPlanSerializedBytes === 0
      ? 0
      : measurement.retainedCacheKeyBytes /
        (measurement.retainedCacheKeyBytes + measurement.retainedPlanSerializedBytes)

  console.log(
    [
      measurement.name,
      `compiled=${measurement.compileCount}`,
      `retained=${measurement.retainedEntries}`,
      `heapDelta=${formatBytes(measurement.heapDelta)}`,
      `heapPerEntry=${formatBytes(heapPerEntry)}`,
      `keyRetained=${formatBytes(measurement.retainedCacheKeyBytes)}`,
      `planJsonRetained=${formatBytes(measurement.retainedPlanSerializedBytes)}`,
      `keyShare=${(keyShare * 100).toFixed(1)}%`,
      `serializedPerEntry=${formatBytes(serializedPerEntry)}`,
    ].join(' | '),
  )
}

async function main(): Promise<void> {
  const dmmf = await getDMMF({ datamodel: BENCHMARK_DATAMODEL })
  const paramGraphData = buildParamGraph(dmmf)
  const runtimeDataModel = dmmfToRuntimeDataModel(dmmf.datamodel)
  const paramGraph = ParamGraphClass.fromData(paramGraphData, (enumName) => {
    const enumDef = runtimeDataModel.enums[enumName]
    const mapping: Record<string, string> = {}
    for (const value of enumDef?.values ?? []) {
      mapping[value.name] = value.dbName ?? value.name
    }
    return mapping
  })

  const QueryCompilerClass = await loadQueryCompiler('sqlite')
  const compiler = new QueryCompilerClass({
    provider: 'sqlite',
    connectionInfo: {
      supportsRelationJoins: false,
    },
    datamodel: BENCHMARK_DATAMODEL,
  })

  compileScenarioQuery(compiler, createFindManyQuery(1), paramGraph, false)
  forceGc()

  const scenarios: Scenario[] = [
    { name: 'scalar selection / cache disabled', kind: 'user-scalar-selection', maxSize: 0, compileCount: 1000 },
    { name: 'scalar selection / edge default warm', kind: 'user-scalar-selection', maxSize: 100, compileCount: 100 },
    { name: 'scalar selection / edge default churn', kind: 'user-scalar-selection', maxSize: 100, compileCount: 1000 },
    { name: 'scalar selection / node default warm', kind: 'user-scalar-selection', maxSize: 1000, compileCount: 1000 },
    { name: 'blog page / edge default warm', kind: 'blog-page', maxSize: 100, compileCount: 100 },
    { name: 'blog page / edge default churn', kind: 'blog-page', maxSize: 100, compileCount: 1000 },
    { name: 'blog page / node default warm', kind: 'blog-page', maxSize: 1000, compileCount: 1000 },
    {
      name: 'blog page parameterized / edge default warm',
      kind: 'blog-page',
      maxSize: 100,
      compileCount: 100,
      parameterized: true,
    },
    {
      name: 'blog page parameterized / edge default churn',
      kind: 'blog-page',
      maxSize: 100,
      compileCount: 1000,
      parameterized: true,
    },
    {
      name: 'blog page parameterized / node default warm',
      kind: 'blog-page',
      maxSize: 1000,
      compileCount: 1000,
      parameterized: true,
    },
  ]

  for (const scenario of scenarios) {
    printMeasurement(measureScenario(compiler, paramGraph, scenario))
  }

  compiler.free?.()
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
