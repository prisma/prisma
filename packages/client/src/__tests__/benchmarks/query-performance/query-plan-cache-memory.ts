import fs from 'node:fs'
import path from 'node:path'

import { dmmfToRuntimeDataModel, type QueryCompiler } from '@prisma/client-common'
import {
  type CompactJoinExpression,
  getPrismaValuePlaceholderName,
  getPrismaValuePlaceholderType,
  getQueryPlanBindingExpr,
  isPrismaValuePlaceholder,
  parameterizeQuery,
  type QueryPlanBinding,
  type QueryPlanCompactNode,
  type QueryPlanDbQuery,
  type QueryPlanNode,
  type RawNestedReadQuery,
} from '@prisma/client-engine-runtime'
import { getDMMF } from '@prisma/client-generator-js'
import type { JsonQuery } from '@prisma/json-protocol'
import type { ParamGraph } from '@prisma/param-graph'
import { ParamGraph as ParamGraphClass } from '@prisma/param-graph'
import { buildParamGraph } from '@prisma/param-graph-builder'

import { renderQuery } from '../../../../../client-engine-runtime/src/interpreter/render-query'
import { QueryPlanCache } from '../../../runtime/core/engines/client/query-plan-cache'
import { loadQueryCompiler } from './qc-loader'

const BENCHMARK_DATAMODEL = fs.readFileSync(path.join(__dirname, 'schema.prisma'), 'utf-8')
const EMPTY_GENERATORS = Object.freeze(Object.create(null)) as Parameters<typeof renderQuery>[2]
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
  renderedDbQueries: number
  retainedCacheKeyBytes: number
  retainedPlanSerializedBytes: number
}

type PlanSizeBreakdown = {
  totalBytes: number
  stringBytes: number
  repeatedStringBytes: number
  arrayCount: number
  objectCount: number
  dbQueryCount: number
  queryCount: number
  dataMapCount: number
  joinCount: number
  rawNestedCount: number
  processCount: number
  topStrings: { value: string; count: number; bytes: number }[]
}

type CacheKeyBreakdown = {
  keyCount: number
  uniqueKeyCount: number
  totalBytes: number
  uniqueBytes: number
  commonPrefixBytes: number
  commonSuffixBytes: number
  prefixSuffixBytes: number
  trieBytes: number
  commonPrefixSample: string
  commonSuffixSample: string
}

type RetainedSize = {
  cacheKeyBytes: number
  planSerializedBytes: number
}

type CompiledScenarioQuery = RetainedSize & {
  cacheKey: string
  placeholderValues: Record<string, unknown>
  plan: QueryPlanNode
}

type RenderOptions = {
  renderPlans: boolean
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

function createScenarioCacheKey(query: JsonQuery, paramGraph: ParamGraph, parameterized: boolean): string {
  const parameterizedResult = parameterized ? parameterizeQuery(query, paramGraph) : undefined
  const cacheQuery = parameterizedResult?.parameterizedQuery ?? query
  const queryPart = JSON.stringify(cacheQuery.query)
  return getSingleQueryCacheKey(cacheQuery, queryPart)
}

function compileScenarioQuery(
  compiler: QueryCompiler,
  query: JsonQuery,
  paramGraph: ParamGraph,
  parameterized: boolean,
): CompiledScenarioQuery {
  const parameterizedResult = parameterized ? parameterizeQuery(query, paramGraph) : undefined
  const cacheQuery = parameterizedResult?.parameterizedQuery ?? query
  const queryPart = JSON.stringify(cacheQuery.query)
  const request = getSingleQueryRequest(cacheQuery, queryPart)
  const cacheKey = getSingleQueryCacheKey(cacheQuery, queryPart)
  const plan = compiler.compile(request)

  return {
    cacheKey,
    cacheKeyBytes: cacheKey.length,
    placeholderValues: parameterizedResult?.placeholderValues ?? {},
    planSerializedBytes: JSON.stringify(plan).length,
    plan,
  }
}

function collectRetainedCacheKeys(paramGraph: ParamGraph, scenario: Scenario): string[] {
  const retainedKeys: string[] = []

  if (scenario.maxSize <= 0) {
    return retainedKeys
  }

  for (let i = 0; i < scenario.compileCount; i++) {
    retainedKeys.push(
      createScenarioCacheKey(createScenarioQuery(scenario, i), paramGraph, scenario.parameterized === true),
    )
    while (retainedKeys.length > scenario.maxSize) {
      retainedKeys.shift()
    }
  }

  return retainedKeys
}

function measureScenario(
  compiler: QueryCompiler,
  paramGraph: ParamGraph,
  scenario: Scenario,
  options: RenderOptions,
): Measurement {
  const cache = new QueryPlanCache(scenario.maxSize)
  const retainedSizes: RetainedSize[] = []
  let renderedDbQueries = 0
  const before = heapUsed()

  for (let i = 0; i < scenario.compileCount; i++) {
    const query = createScenarioQuery(scenario, i)
    const { cacheKey, cacheKeyBytes, placeholderValues, planSerializedBytes, plan } = compileScenarioQuery(
      compiler,
      query,
      paramGraph,
      scenario.parameterized === true,
    )

    cache.setSingle(cacheKey, plan)
    if (options.renderPlans) {
      renderedDbQueries += renderDbQueriesInPlan(plan, placeholderValues)
    }

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
    renderedDbQueries,
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
      ...(measurement.renderedDbQueries === 0 ? [] : [`renderedDbQueries=${measurement.renderedDbQueries}`]),
      `keyRetained=${formatBytes(measurement.retainedCacheKeyBytes)}`,
      `planJsonRetained=${formatBytes(measurement.retainedPlanSerializedBytes)}`,
      `keyShare=${(keyShare * 100).toFixed(1)}%`,
      `serializedPerEntry=${formatBytes(serializedPerEntry)}`,
    ].join(' | '),
  )
}

function renderDbQueriesInPlan(plan: QueryPlanNode, placeholderValues: Record<string, unknown>): number {
  const dbQueries: QueryPlanDbQuery[] = []
  collectDbQueries(plan, dbQueries)

  for (const dbQuery of dbQueries) {
    renderQuery(dbQuery, createRenderScope(dbQuery, placeholderValues), EMPTY_GENERATORS, 999)
  }

  return dbQueries.length
}

function collectDbQueriesInCompactJoins(joins: CompactJoinExpression[], dbQueries: QueryPlanDbQuery[]): void {
  for (const join of joins) {
    collectDbQueries(join[0], dbQueries)
  }
}

function collectDbQueriesInRawNestedRead(query: RawNestedReadQuery, dbQueries: QueryPlanDbQuery[]): void {
  dbQueries.push(query[0])
  for (const relation of query[2] ?? []) {
    if (relation[0] === 'r') {
      collectDbQueriesInRawNestedRead(relation[2], dbQueries)
    } else {
      dbQueries.push(relation[2])
      collectDbQueriesInRawNestedRead(relation[3], dbQueries)
    }
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

function isCompactPlanNode(plan: QueryPlanNode): plan is QueryPlanCompactNode {
  return Array.isArray(plan)
}

function createRenderScope(
  dbQuery: QueryPlanDbQuery,
  placeholderValues: Record<string, unknown>,
): Record<string, unknown> {
  const scope: Record<string, unknown> = { ...placeholderValues }
  collectDbQueryPlaceholderDefaults(dbQuery, scope)
  return scope
}

function collectDbQueryPlaceholderDefaults(dbQuery: QueryPlanDbQuery, scope: Record<string, unknown>): void {
  if (Array.isArray(dbQuery)) {
    collectQueryArgPlaceholderDefaults(dbQuery[2], dbQuery[3], dbQuery[0], scope)
    return
  }

  collectQueryArgPlaceholderDefaults(dbQuery.args, dbQuery.argTypes, undefined, scope)
}

function collectQueryArgPlaceholderDefaults(
  args: readonly unknown[],
  argTypes: readonly unknown[],
  fragments: readonly unknown[] | undefined,
  scope: Record<string, unknown>,
): void {
  if (fragments === undefined) {
    for (let i = 0; i < args.length; i++) {
      collectPlaceholderDefaults(args[i], scope, argTypes[i], 'scalar')
    }
    return
  }

  let argIndex = 0
  for (const fragment of fragments) {
    const kind = getFragmentArgKind(fragment)
    if (kind === undefined) {
      continue
    }
    collectPlaceholderDefaults(args[argIndex], scope, argTypes[argIndex], kind)
    argIndex++
  }
}

function getFragmentArgKind(fragment: unknown): 'scalar' | 'tuple' | 'tupleList' | undefined {
  if (fragment === null) {
    return 'scalar'
  }

  if (Array.isArray(fragment)) {
    switch (fragment[0]) {
      case 'T':
        return 'tuple'
      case 'L':
        return 'tupleList'
      default:
        return undefined
    }
  }

  return undefined
}

function collectPlaceholderDefaults(
  value: unknown,
  scope: Record<string, unknown>,
  argType: unknown,
  kind: 'scalar' | 'tuple' | 'tupleList',
): void {
  if (isPrismaValuePlaceholder(value)) {
    const name = getPrismaValuePlaceholderName(value)
    if (scope[name] === undefined) {
      scope[name] = placeholderDefaultValue(getPrismaValuePlaceholderType(value), argType, kind)
    }
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectPlaceholderDefaults(item, scope, argType, 'scalar')
    }
    return
  }

  if (typeof value !== 'object' || value === null) {
    return
  }

  for (const entry of Object.values(value)) {
    collectPlaceholderDefaults(entry, scope, argType, 'scalar')
  }
}

function placeholderDefaultValue(
  placeholderType: string,
  argType: unknown,
  kind: 'scalar' | 'tuple' | 'tupleList',
): unknown {
  switch (kind) {
    case 'tuple':
      return tupleDefaultValue(placeholderType, argType)
    case 'tupleList':
      return [tupleDefaultValue(placeholderType, argType)]
    case 'scalar':
      return scalarDefaultValue(placeholderType)
  }
}

function tupleDefaultValue(placeholderType: string, argType: unknown): unknown[] {
  if (isTupleArgType(argType)) {
    return argType.elements.map((element) => scalarDefaultValueFromArgType(element, placeholderType))
  }

  return [scalarDefaultValue(placeholderType)]
}

function isTupleArgType(argType: unknown): argType is { arity: 'tuple'; elements: unknown[] } {
  return (
    typeof argType === 'object' &&
    argType !== null &&
    !Array.isArray(argType) &&
    (argType as { arity?: unknown }).arity === 'tuple'
  )
}

function scalarDefaultValueFromArgType(argType: unknown, fallbackType: string): unknown {
  if (typeof argType !== 'string') {
    return scalarDefaultValue(fallbackType)
  }

  switch (argType) {
    case 's':
      return scalarDefaultValue('String')
    case 'i':
      return scalarDefaultValue('Int')
    case 'I':
      return scalarDefaultValue('BigInt')
    case 'f':
    case 'd':
      return scalarDefaultValue('Float')
    case 'b':
      return scalarDefaultValue('Boolean')
    case 'u':
      return scalarDefaultValue('String')
    case 'j':
      return scalarDefaultValue('Json')
    case 'D':
      return scalarDefaultValue('DateTime')
    case 'B':
      return scalarDefaultValue('Bytes')
    default:
      return scalarDefaultValue(fallbackType)
  }
}

function scalarDefaultValue(type: string): unknown {
  switch (type) {
    case 'Boolean':
      return true
    case 'Float':
    case 'Decimal':
      return 1.5
    case 'DateTime':
      return new Date(0)
    case 'Bytes':
      return new Uint8Array(0)
    case 'Json':
      return {}
    case 'String':
    case 'Enum':
      return 'x'
    case 'BigInt':
      return 1n
    case 'Int':
    default:
      return 1
  }
}

function collectPlanSizeBreakdown(plan: QueryPlanNode): PlanSizeBreakdown {
  const stringCounts = new Map<string, number>()
  let arrayCount = 0
  let objectCount = 0
  let queryCount = 0
  let dataMapCount = 0
  let joinCount = 0
  let rawNestedCount = 0
  let processCount = 0

  function visit(value: unknown): void {
    if (typeof value === 'string') {
      stringCounts.set(value, (stringCounts.get(value) ?? 0) + 1)
      return
    }

    if (Array.isArray(value)) {
      arrayCount++
      const tag = value[0]
      if (tag === 'q' || tag === 'x') {
        queryCount++
      } else if (tag === 'd') {
        dataMapCount++
      } else if (tag === 'j') {
        joinCount++
      } else if (tag === 'n') {
        rawNestedCount++
      } else if (tag === 'p') {
        processCount++
      }

      for (let i = 0; i < value.length; i++) {
        visit(value[i])
      }
      return
    }

    if (typeof value !== 'object' || value === null) {
      return
    }

    objectCount++
    for (const [key, entry] of Object.entries(value)) {
      visit(key)
      visit(entry)
    }
  }

  visit(plan)

  let stringBytes = 0
  let repeatedStringBytes = 0
  const topStrings: PlanSizeBreakdown['topStrings'] = []
  for (const [value, count] of stringCounts) {
    const bytes = JSON.stringify(value).length * count
    stringBytes += bytes
    if (count > 1) {
      repeatedStringBytes += JSON.stringify(value).length * (count - 1)
    }
    topStrings.push({ value, count, bytes })
  }
  topStrings.sort((a, b) => b.bytes - a.bytes)
  const dbQueries: QueryPlanDbQuery[] = []
  collectDbQueries(plan, dbQueries)

  return {
    totalBytes: JSON.stringify(plan).length,
    stringBytes,
    repeatedStringBytes,
    arrayCount,
    objectCount,
    dbQueryCount: dbQueries.length,
    queryCount,
    dataMapCount,
    joinCount,
    rawNestedCount,
    processCount,
    topStrings: topStrings.slice(0, 20),
  }
}

function printPlanSizeBreakdown(label: string, plan: QueryPlanNode): void {
  const breakdown = collectPlanSizeBreakdown(plan)

  console.log(`${label} plan size breakdown`)
  console.log(
    [
      `total=${formatBytes(breakdown.totalBytes)}`,
      `strings=${formatBytes(breakdown.stringBytes)}`,
      `repeatedStrings=${formatBytes(breakdown.repeatedStringBytes)}`,
      `arrays=${breakdown.arrayCount}`,
      `objects=${breakdown.objectCount}`,
      `dbQueries=${breakdown.dbQueryCount}`,
      `queries=${breakdown.queryCount}`,
      `dataMaps=${breakdown.dataMapCount}`,
      `joins=${breakdown.joinCount}`,
      `rawNested=${breakdown.rawNestedCount}`,
      `process=${breakdown.processCount}`,
    ].join(' | '),
  )

  for (const entry of breakdown.topStrings) {
    const printable = entry.value.length > 120 ? `${entry.value.slice(0, 117)}...` : entry.value
    console.log(`  ${JSON.stringify(printable)} | count=${entry.count} | bytes=${formatBytes(entry.bytes)}`)
  }
}

function collectCacheKeyBreakdown(keys: string[]): CacheKeyBreakdown {
  const totalBytes = keys.reduce((total, key) => total + key.length, 0)
  const uniqueKeys = new Set(keys)
  let uniqueBytes = 0
  for (const key of uniqueKeys) {
    uniqueBytes += key.length
  }

  const commonPrefixBytes = commonPrefixLength(keys)
  const commonSuffixBytes = commonSuffixLength(keys, commonPrefixBytes)
  const prefixSuffixBytes =
    keys.length === 0
      ? 0
      : commonPrefixBytes +
        commonSuffixBytes +
        keys.reduce((total, key) => total + key.length - commonPrefixBytes - commonSuffixBytes, 0)
  const trieBytes = countTrieBytes(keys)

  return {
    keyCount: keys.length,
    uniqueKeyCount: uniqueKeys.size,
    totalBytes,
    uniqueBytes,
    commonPrefixBytes,
    commonSuffixBytes,
    prefixSuffixBytes,
    trieBytes,
    commonPrefixSample: keys[0]?.slice(0, commonPrefixBytes) ?? '',
    commonSuffixSample: commonSuffixBytes === 0 ? '' : (keys[0]?.slice(-commonSuffixBytes) ?? ''),
  }
}

function commonPrefixLength(values: string[]): number {
  if (values.length === 0) {
    return 0
  }

  const first = values[0]
  let end = first.length
  for (let i = 1; i < values.length; i++) {
    const value = values[i]
    end = Math.min(end, value.length)
    let index = 0
    while (index < end && first.charCodeAt(index) === value.charCodeAt(index)) {
      index++
    }
    end = index
    if (end === 0) {
      break
    }
  }
  return end
}

function commonSuffixLength(values: string[], commonPrefixBytes: number): number {
  if (values.length === 0) {
    return 0
  }

  const first = values[0]
  let end = first.length - commonPrefixBytes
  for (let i = 1; i < values.length; i++) {
    const value = values[i]
    end = Math.min(end, value.length - commonPrefixBytes)
    let index = 0
    while (index < end && first.charCodeAt(first.length - 1 - index) === value.charCodeAt(value.length - 1 - index)) {
      index++
    }
    end = index
    if (end === 0) {
      break
    }
  }
  return end
}

function countTrieBytes(keys: string[]): number {
  type TrieNode = Map<number, TrieNode>

  const root: TrieNode = new Map()
  let bytes = 0

  for (const key of keys) {
    let node = root
    for (let i = 0; i < key.length; i++) {
      const code = key.charCodeAt(i)
      let child = node.get(code)
      if (child === undefined) {
        child = new Map()
        node.set(code, child)
        bytes++
      }
      node = child
    }
  }

  return bytes
}

function printCacheKeyBreakdown(scenario: Scenario, keys: string[]): void {
  const breakdown = collectCacheKeyBreakdown(keys)
  const prefixSuffixSavings = breakdown.totalBytes - breakdown.prefixSuffixBytes
  const trieSavings = breakdown.totalBytes - breakdown.trieBytes

  console.log(`${scenario.name} cache-key breakdown`)
  console.log(
    [
      `keys=${breakdown.keyCount}`,
      `unique=${breakdown.uniqueKeyCount}`,
      `total=${formatBytes(breakdown.totalBytes)}`,
      `uniqueTotal=${formatBytes(breakdown.uniqueBytes)}`,
      `commonPrefix=${formatBytes(breakdown.commonPrefixBytes)}`,
      `commonSuffix=${formatBytes(breakdown.commonSuffixBytes)}`,
      `prefixSuffixBytes=${formatBytes(breakdown.prefixSuffixBytes)}`,
      `prefixSuffixSavings=${formatBytes(prefixSuffixSavings)}`,
      `trieBytes=${formatBytes(breakdown.trieBytes)}`,
      `trieSavings=${formatBytes(trieSavings)}`,
      `trieSavingsShare=${breakdown.totalBytes === 0 ? '0.0%' : `${((trieSavings / breakdown.totalBytes) * 100).toFixed(1)}%`}`,
    ].join(' | '),
  )

  if (breakdown.commonPrefixSample.length > 0) {
    const prefix =
      breakdown.commonPrefixSample.length > 120
        ? `${breakdown.commonPrefixSample.slice(0, 117)}...`
        : breakdown.commonPrefixSample
    console.log(`  commonPrefixSample=${JSON.stringify(prefix)}`)
  }

  if (breakdown.commonSuffixSample.length > 0) {
    const suffix =
      breakdown.commonSuffixSample.length > 120
        ? `...${breakdown.commonSuffixSample.slice(-(120 - 3))}`
        : breakdown.commonSuffixSample
    console.log(`  commonSuffixSample=${JSON.stringify(suffix)}`)
  }
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

  const renderPlans = process.env.QUERY_PLAN_CACHE_MEMORY_RENDER === '1'

  if (process.env.QUERY_PLAN_CACHE_MEMORY_BREAKDOWN === '1') {
    printPlanSizeBreakdown(
      'scalar selection',
      compileScenarioQuery(compiler, createFindManyQuery(1), paramGraph, false).plan,
    )
    printPlanSizeBreakdown(
      'blog page',
      compileScenarioQuery(compiler, createBlogPostPageQuery((1 << POST_SCALAR_FIELDS.length) - 1), paramGraph, false)
        .plan,
    )
    compiler.free?.()
    return
  }

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

  if (process.env.QUERY_PLAN_CACHE_KEY_BREAKDOWN === '1') {
    for (const scenario of scenarios) {
      if (scenario.maxSize > 0) {
        printCacheKeyBreakdown(scenario, collectRetainedCacheKeys(paramGraph, scenario))
      }
    }
    compiler.free?.()
    return
  }

  for (const scenario of scenarios) {
    printMeasurement(measureScenario(compiler, paramGraph, scenario, { renderPlans }))
  }

  compiler.free?.()
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
