import fs from 'node:fs'
import path from 'node:path'

import type { QueryCompiler } from '@prisma/client-common'
import type { JsonQuery } from '@prisma/json-protocol'

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

type Scenario = {
  name: string
  maxSize: number
  compileCount: number
}

type Measurement = Scenario & {
  retainedEntries: number
  heapDelta: number
  retainedSerializedBytes: number
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

function retainedSerializedSize(retainedSizes: number[]): number {
  let result = 0
  for (let i = 0; i < retainedSizes.length; i++) {
    result += retainedSizes[i]
  }
  return result
}

function measureScenario(compiler: QueryCompiler, scenario: Scenario): Measurement {
  const cache = new QueryPlanCache(scenario.maxSize)
  const retainedSizes: number[] = []
  const before = heapUsed()

  for (let i = 0; i < scenario.compileCount; i++) {
    const query = createFindManyQuery((i % 1023) + 1)
    const queryPart = JSON.stringify(query.query)
    const request = getSingleQueryRequest(query, queryPart)
    const cacheKey = getSingleQueryCacheKey(query, queryPart)
    const plan = compiler.compile(request)

    cache.setSingle(cacheKey, plan)

    if (scenario.maxSize > 0) {
      retainedSizes.push(cacheKey.length + JSON.stringify(plan).length)
      while (retainedSizes.length > scenario.maxSize) {
        retainedSizes.shift()
      }
    }
  }

  const after = heapUsed()
  const measurement = {
    ...scenario,
    retainedEntries: cache.singleCacheSize,
    heapDelta: after - before,
    retainedSerializedBytes: retainedSerializedSize(retainedSizes),
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
      : Math.round(measurement.retainedSerializedBytes / measurement.retainedEntries)

  console.log(
    [
      measurement.name,
      `compiled=${measurement.compileCount}`,
      `retained=${measurement.retainedEntries}`,
      `heapDelta=${formatBytes(measurement.heapDelta)}`,
      `heapPerEntry=${formatBytes(heapPerEntry)}`,
      `serializedRetained=${formatBytes(measurement.retainedSerializedBytes)}`,
      `serializedPerEntry=${formatBytes(serializedPerEntry)}`,
    ].join(' | '),
  )
}

async function main(): Promise<void> {
  const QueryCompilerClass = await loadQueryCompiler('sqlite')
  const compiler = new QueryCompilerClass({
    provider: 'sqlite',
    connectionInfo: {
      supportsRelationJoins: false,
    },
    datamodel: BENCHMARK_DATAMODEL,
  })

  compiler.compile(getSingleQueryRequest(createFindManyQuery(1), JSON.stringify(createFindManyQuery(1).query)))
  forceGc()

  const scenarios: Scenario[] = [
    { name: 'cache disabled', maxSize: 0, compileCount: 1000 },
    { name: 'edge default warm', maxSize: 100, compileCount: 100 },
    { name: 'edge default churn', maxSize: 100, compileCount: 1000 },
    { name: 'node default warm', maxSize: 1000, compileCount: 1000 },
  ]

  for (const scenario of scenarios) {
    printMeasurement(measureScenario(compiler, scenario))
  }

  compiler.free?.()
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
