import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { dmmfToRuntimeDataModel, type RuntimeDataModel } from '@prisma/client-common'
import { getDMMF } from '@prisma/client-generator-js'
import type { SerializedParamGraph } from '@prisma/param-graph'
import { buildAndSerializeParamGraph } from '@prisma/param-graph-builder'

const BENCHMARK_DATAMODEL = fs.readFileSync(path.join(__dirname, 'schema.prisma'), 'utf-8')
const RUNTIME_BASE = path.join(__dirname, '..', '..', '..', '..', 'runtime')
const RUNTIME_PATH = path.join(RUNTIME_BASE, 'query_compiler_fast_bg.sqlite.mjs')
const WASM_BASE64_PATH = path.join(RUNTIME_BASE, 'query_compiler_fast_bg.sqlite.wasm-base64.mjs')
const WASM_COMPILER_EDGE_PATH = path.join(RUNTIME_BASE, 'wasm-compiler-edge.mjs')
const LOCAL_QC_BUILD_DIRECTORY = process.env.LOCAL_QC_BUILD_DIRECTORY
const GENERATED_FIND_UNIQUE_ITERATIONS = positiveIntegerEnv('WORKERD_GENERATED_FIND_UNIQUE_ITERATIONS', 5_000)
const GENERATED_BLOG_PAGE_ITERATIONS = positiveIntegerEnv('WORKERD_GENERATED_BLOG_PAGE_ITERATIONS', 1_000)
const CLIENT_CACHE_KEY_ITERATIONS = positiveIntegerEnv('WORKERD_CLIENT_CACHE_KEY_ITERATIONS', 20_000)
const DESCRIPTOR_ITERATIONS = positiveIntegerEnv('WORKERD_DESCRIPTOR_ITERATIONS', 20_000)
const PRECOMPUTED_ITERATIONS = positiveIntegerEnv('WORKERD_PRECOMPUTED_ITERATIONS', 20_000)
const CLIENT_RUNTIME_UTILS_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'client-runtime-utils',
  'dist',
  'index.mjs',
)

type MiniflareInstance = {
  dispatchFetch(url: string): Promise<Response>
  dispose(): Promise<void>
}

type MiniflareConstructor = new (opts: {
  modules: Array<
    { type: 'ESModule'; path: string; contents: string } | { type: 'CompiledWasm'; path: string; contents: Uint8Array }
  >
  modulesRoot: string
  compatibilityDate: string
}) => MiniflareInstance

type MemorySnapshot = {
  rss: number
  heapUsed: number
  external: number
  arrayBuffers: number
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

type WorkerRunResult = {
  scenario: string
  mode: string
  iterations: number
  retain: boolean
  initMs: number
  compileMs?: number
  elapsedMs?: number
  averageUs?: number
  cacheHits: number
  cacheMisses: number
  compileCount?: number
  compileBatchCount?: number
  queryRawCount?: number
  executeRawCount?: number
  precomputedFastPathHits?: number
  precomputedFastPathLearns?: number
  precomputedBatchHits?: number
  checksum?: number
  retainedEntries: number
  retainedCacheKeyBytes: number
  retainedCacheKeyBreakdown?: CacheKeyBreakdown
  retainedPlanSerializedBytes: number
  averagePlanBytes: number
  runtime: string
}

type Measurement = {
  label: string
  worker: WorkerRunResult
  hostElapsedMs: number
  hostMemory: {
    before: MemorySnapshot
    after: MemorySnapshot
    delta: MemorySnapshot
  }
}

function positiveIntegerEnv(name: string, defaultValue: number): number {
  const value = process.env[name]
  if (value === undefined) {
    return defaultValue
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, got ${JSON.stringify(value)}`)
  }

  return parsed
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

function formatMs(ms: number): string {
  return `${ms.toFixed(1)} ms`
}

function forceGc(): void {
  const gc = (globalThis as typeof globalThis & { gc?: () => void }).gc
  if (typeof gc !== 'function') {
    throw new Error(
      'Run this probe with `pnpm exec node --expose-gc --import tsx packages/client/src/__tests__/benchmarks/query-performance/workerd-query-compiler-memory.ts`.',
    )
  }

  for (let i = 0; i < 5; i++) {
    gc()
  }
}

function memorySnapshot(): MemorySnapshot {
  forceGc()
  const usage = process.memoryUsage()
  return {
    rss: usage.rss,
    heapUsed: usage.heapUsed,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers,
  }
}

function memoryDelta(before: MemorySnapshot, after: MemorySnapshot): MemorySnapshot {
  return {
    rss: after.rss - before.rss,
    heapUsed: after.heapUsed - before.heapUsed,
    external: after.external - before.external,
    arrayBuffers: after.arrayBuffers - before.arrayBuffers,
  }
}

async function loadMiniflare(): Promise<MiniflareConstructor | undefined> {
  try {
    const wranglerPath = require.resolve('wrangler')
    const wranglerPackageRoot = wranglerPath.split('/node_modules/wrangler/')[0]
    const miniflareIndex = path.join(wranglerPackageRoot, 'node_modules/miniflare/dist/src/index.js')
    const miniflareModule = (await import(miniflareIndex)) as { Miniflare: MiniflareConstructor }
    return miniflareModule.Miniflare
  } catch (error) {
    console.log(
      `Skipping workerd query compiler memory probe: could not load Miniflare from Wrangler (${String(error)}).`,
    )
    return undefined
  }
}

async function loadWasmBytes(): Promise<Uint8Array> {
  if (LOCAL_QC_BUILD_DIRECTORY !== undefined) {
    return fs.promises.readFile(path.join(LOCAL_QC_BUILD_DIRECTORY, 'sqlite', 'query_compiler_fast_bg.wasm'))
  }

  const wasmModule = (await import(pathToFileURL(WASM_BASE64_PATH).href)) as { wasm: string }
  return new Uint8Array(Buffer.from(wasmModule.wasm, 'base64'))
}

function loadRuntimeModuleContents(): string {
  if (LOCAL_QC_BUILD_DIRECTORY !== undefined) {
    return fs.readFileSync(path.join(LOCAL_QC_BUILD_DIRECTORY, 'sqlite', 'query_compiler_fast_bg.js'), 'utf-8')
  }

  return fs.readFileSync(RUNTIME_PATH, 'utf-8')
}

function buildWorkerModule(config: {
  runtimeDataModel: RuntimeDataModel
  parameterizationSchema: SerializedParamGraph
}): string {
  return `
import * as runtime from './query_compiler_fast_bg.sqlite.mjs'
import { getPrismaClient } from './wasm-compiler-edge.mjs'
import wasmModule from './query_compiler_fast_bg.sqlite.wasm'

const datamodel = ${JSON.stringify(BENCHMARK_DATAMODEL)}
const runtimeDataModel = ${JSON.stringify(config.runtimeDataModel)}
const parameterizationSchema = ${JSON.stringify(config.parameterizationSchema)}
const userScalarFields = ['id', 'email', 'name', 'username', 'bio', 'avatar', 'isActive', 'role', 'createdAt', 'updatedAt']
const postScalarFields = [
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
]

let compiler
let PrismaClient
let initMs = 0
const retainedPlans = new Map()
const counts = {
  compile: 0,
  compileBatch: 0,
  queryRaw: 0,
  executeRaw: 0,
  precomputedFastPathHits: 0,
  precomputedFastPathLearns: 0,
  precomputedBatchHits: 0,
}

function getCompiler() {
  if (compiler) {
    return compiler
  }

  const start = performance.now()
  globalThis.PRISMA_WASM_PANIC_REGISTRY = { set_message() {} }
  const instance = new WebAssembly.Instance(wasmModule, { './query_compiler_fast_bg.js': runtime })
  runtime.__wbg_set_wasm(instance.exports)
  instance.exports.__wbindgen_start()
  compiler = new runtime.QueryCompiler({
    datamodel,
    provider: 'sqlite',
    connectionInfo: { supportsRelationJoins: false },
  })
  initMs = performance.now() - start
  return compiler
}

function resetCounts() {
  counts.compile = 0
  counts.compileBatch = 0
  counts.queryRaw = 0
  counts.executeRaw = 0
  counts.precomputedFastPathHits = 0
  counts.precomputedFastPathLearns = 0
  counts.precomputedBatchHits = 0
}

function getRuntimeWithCountingCompiler() {
  const QueryCompiler = runtime.QueryCompiler

  return {
    ...runtime,
    QueryCompiler: class CountingQueryCompiler {
      constructor(options) {
        this.compiler = new QueryCompiler(options)
      }

      compile(request) {
        counts.compile++
        return this.compiler.compile(request)
      }

      compileBatch(request) {
        counts.compileBatch++
        return this.compiler.compileBatch(request)
      }

      free() {
        this.compiler.free()
      }
    },
  }
}

function getPrismaClientConstructor() {
  if (PrismaClient) {
    return PrismaClient
  }

  PrismaClient = getPrismaClient({
    runtimeDataModel,
    previewFeatures: [],
    clientVersion: '0.0.0',
    engineVersion: '0000000000000000000000000000000000000000',
    activeProvider: 'sqlite',
    inlineSchema: datamodel,
    compilerWasm: {
      getRuntime: () => Promise.resolve(getRuntimeWithCountingCompiler()),
      getQueryCompilerWasmModule: () => Promise.resolve(wasmModule),
      importName: './query_compiler_fast_bg.js',
    },
    parameterizationSchema,
  })
  return PrismaClient
}

const ColumnType = {
  Int32: 0,
  Boolean: 5,
  Text: 7,
  DateTime: 10,
}
const EMPTY_RESULT = Object.freeze({
  columnNames: Object.freeze([]),
  columnTypes: Object.freeze([]),
  rows: Object.freeze([]),
})
const USER_SCALAR_RESULT = Object.freeze({
  columnNames: Object.freeze(['id', 'email', 'name']),
  columnTypes: Object.freeze([ColumnType.Int32, ColumnType.Text, ColumnType.Text]),
  rows: Object.freeze([Object.freeze([1, 'user1@example.test', 'User 1'])]),
})
const BLOG_PAGE_POST_RESULT = Object.freeze({
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
    ColumnType.Int32,
    ColumnType.Text,
    ColumnType.Text,
    ColumnType.Text,
    ColumnType.Boolean,
    ColumnType.Int32,
    ColumnType.DateTime,
    ColumnType.Int32,
    ColumnType.Int32,
    ColumnType.Int32,
    ColumnType.Int32,
  ]),
  rows: Object.freeze([
    Object.freeze([1, 'Hello', 'hello', 'Body', true, 7, new Date('2024-01-01T00:00:00.000Z'), 10, 20, 3, 2]),
  ]),
})
const BLOG_PAGE_AUTHOR_RESULT = Object.freeze({
  columnNames: Object.freeze(['id', 'name', 'avatar']),
  columnTypes: Object.freeze([ColumnType.Int32, ColumnType.Text, ColumnType.Text]),
  rows: Object.freeze([Object.freeze([10, 'Alice', 'alice.png'])]),
})
const BLOG_PAGE_CATEGORY_RESULT = Object.freeze({
  columnNames: Object.freeze(['id', 'name', 'slug']),
  columnTypes: Object.freeze([ColumnType.Int32, ColumnType.Text, ColumnType.Text]),
  rows: Object.freeze([Object.freeze([20, 'Engineering', 'engineering'])]),
})
const BLOG_PAGE_POST_TAG_RESULT = Object.freeze({
  columnNames: Object.freeze(['postId', 'tagId']),
  columnTypes: Object.freeze([ColumnType.Int32, ColumnType.Int32]),
  rows: Object.freeze([Object.freeze([1, 100]), Object.freeze([1, 101])]),
})
const BLOG_PAGE_TAG_RESULT = Object.freeze({
  columnNames: Object.freeze(['id', 'name', 'slug']),
  columnTypes: Object.freeze([ColumnType.Int32, ColumnType.Text, ColumnType.Text]),
  rows: Object.freeze([Object.freeze([100, 'Rust', 'rust']), Object.freeze([101, 'Wasm', 'wasm'])]),
})
const BLOG_PAGE_COMMENT_RESULT = Object.freeze({
  columnNames: Object.freeze(['id', 'content', 'createdAt', 'authorId', 'postId']),
  columnTypes: Object.freeze([ColumnType.Int32, ColumnType.Text, ColumnType.DateTime, ColumnType.Int32, ColumnType.Int32]),
  rows: Object.freeze([
    Object.freeze([200, 'Nice', new Date('2024-01-02T00:00:00.000Z'), 11, 1]),
    Object.freeze([201, 'Great', new Date('2024-01-03T00:00:00.000Z'), 12, 1]),
  ]),
})
const BLOG_PAGE_COMMENT_AUTHOR_RESULT = Object.freeze({
  columnNames: Object.freeze(['id', 'name', 'avatar']),
  columnTypes: Object.freeze([ColumnType.Int32, ColumnType.Text, ColumnType.Text]),
  rows: Object.freeze([Object.freeze([11, 'Bob', 'bob.png']), Object.freeze([12, 'Carla', 'carla.png'])]),
})

class BenchmarkTransaction {
  provider = 'sqlite'
  adapterName = '@prisma/adapter-benchmark-workerd'
  options = { usePhantomQuery: false }

  constructor(adapter) {
    this.adapter = adapter
  }

  queryRaw(query) {
    return this.adapter.queryRaw(query)
  }

  executeRaw(query) {
    return this.adapter.executeRaw(query)
  }

  commit() {
    return Promise.resolve()
  }

  rollback() {
    return Promise.resolve()
  }
}

class BenchmarkAdapter {
  provider = 'sqlite'
  adapterName = '@prisma/adapter-benchmark-workerd'

  queryRaw(query) {
    counts.queryRaw++
    return Promise.resolve(getResultSet(query.sql))
  }

  executeRaw() {
    counts.executeRaw++
    return Promise.resolve(0)
  }

  executeScript() {
    return Promise.resolve()
  }

  startTransaction() {
    return Promise.resolve(new BenchmarkTransaction(this))
  }

  getConnectionInfo() {
    return { supportsRelationJoins: false }
  }

  dispose() {
    return Promise.resolve()
  }
}

function createAdapterFactory() {
  return {
    provider: 'sqlite',
    adapterName: '@prisma/adapter-benchmark-workerd',
    connect: () => Promise.resolve(new BenchmarkAdapter()),
  }
}

function getResultSet(sql) {
  if (sql.includes('FROM \`main\`.\`Post\`')) {
    return BLOG_PAGE_POST_RESULT
  }

  if (sql.includes('FROM \`main\`.\`Category\`')) {
    return BLOG_PAGE_CATEGORY_RESULT
  }

  if (sql.includes('FROM \`main\`.\`PostTag\`')) {
    return BLOG_PAGE_POST_TAG_RESULT
  }

  if (sql.includes('FROM \`main\`.\`Tag\`')) {
    return BLOG_PAGE_TAG_RESULT
  }

  if (sql.includes('FROM \`main\`.\`Comment\`')) {
    return BLOG_PAGE_COMMENT_RESULT
  }

  if (sql.includes('FROM \`main\`.\`User\`') && sql.includes('\`email\`')) {
    return USER_SCALAR_RESULT
  }

  if (sql.includes('FROM \`main\`.\`User\`') && sql.includes(' IN ')) {
    return BLOG_PAGE_COMMENT_AUTHOR_RESULT
  }

  if (sql.includes('FROM \`main\`.\`User\`')) {
    return BLOG_PAGE_AUTHOR_RESULT
  }

  if (sql === undefined) {
    return EMPTY_RESULT
  }

  throw new Error('Unexpected client-execute benchmark SQL: ' + sql)
}

function getStringCacheKeyPart(value) {
  if (value == null) {
    return '-1:'
  }

  return value.length + ':' + value
}

function getSingleQueryCacheKey(query, queryPart) {
  return 's:' + getStringCacheKeyPart(query.modelName) + getStringCacheKeyPart(query.action) + queryPart.length + ':' + queryPart
}

function getSingleQueryRequest(query, queryPart) {
  const actionPart = JSON.stringify(query.action)

  if (query.modelName === undefined) {
    return '{"action":' + actionPart + ',"query":' + queryPart + '}'
  }

  return '{"modelName":' + JSON.stringify(query.modelName) + ',"action":' + actionPart + ',"query":' + queryPart + '}'
}

function createParam(name, type) {
  return { $type: 'Param', value: { name, type } }
}

function createFindUniqueQuery(iteration) {
  return {
    modelName: 'User',
    action: 'findUnique',
    query: {
      arguments: { where: { id: iteration + 1 } },
      selection: { $scalars: true },
    },
  }
}

function createFindManyQuery(mask) {
  const selection = {}

  for (let i = 0; i < userScalarFields.length; i++) {
    if ((mask & (1 << i)) !== 0) {
      selection[userScalarFields[i]] = true
    }
  }

  return {
    modelName: 'User',
    action: 'findMany',
    query: { selection },
  }
}

function createBlogPostPageQuery(mask) {
  const selection = {}

  for (let i = 0; i < postScalarFields.length; i++) {
    if ((mask & (1 << i)) !== 0) {
      selection[postScalarFields[i]] = true
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

function createBlogPostPageByIdQuery(id) {
  const query = createBlogPostPageQuery((1 << postScalarFields.length) - 1)
  query.query.arguments.where.id = id
  return query
}

function createFindUniqueArgs(iteration) {
  return {
    where: { id: iteration + 1 },
    select: {
      id: true,
      email: true,
      name: true,
    },
  }
}

function createBlogPostPageArgs(iteration) {
  return {
    where: { id: iteration + 1 },
    select: {
      id: true,
      title: true,
      slug: true,
      content: true,
      published: true,
      viewCount: true,
      createdAt: true,
      author: {
        select: {
          id: true,
          name: true,
          avatar: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      tags: {
        select: {
          tag: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
      comments: {
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
      },
      _count: {
        select: {
          likes: true,
          comments: true,
        },
      },
    },
  }
}

const blogPageRootSelectKeys = [
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
]
const blogPageRootScalarFields = ['id', 'title', 'slug', 'content', 'published', 'viewCount', 'createdAt']
const blogPageUserSelectKeys = ['id', 'name', 'avatar']
const blogPageSlugSelectKeys = ['id', 'name', 'slug']
const blogPageCommentSelectKeys = ['id', 'content', 'createdAt', 'author']
const blogPageCountSelectKeys = ['likes', 'comments']

function createClientArgs(scenario, iteration) {
  switch (scenario) {
    case 'find-unique':
      return createFindUniqueArgs(iteration)
    case 'blog-page':
    case 'blog-page-by-id':
      return createBlogPostPageArgs(iteration)
    default:
      throw new Error('Unknown client args scenario: ' + scenario)
  }
}

function createClientProtocolQuery(scenario, iteration) {
  switch (scenario) {
    case 'find-unique':
      return {
        modelName: 'User',
        action: 'findUnique',
        query: {
          arguments: { where: { id: iteration + 1 } },
          selection: {
            id: true,
            email: true,
            name: true,
          },
        },
      }
    case 'blog-page':
    case 'blog-page-by-id':
      return {
        modelName: 'Post',
        action: 'findUnique',
        query: {
          arguments: { where: { id: iteration + 1 } },
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
    default:
      throw new Error('Unknown client protocol scenario: ' + scenario)
  }
}

function tryExtractStaticDescriptor(scenario, args, cacheKey) {
  switch (scenario) {
    case 'find-unique':
      return tryExtractFindUniqueDescriptor(args, cacheKey)
    case 'blog-page':
    case 'blog-page-by-id':
      return tryExtractBlogPostPageDescriptor(args, cacheKey)
    default:
      throw new Error('Unknown static descriptor scenario: ' + scenario)
  }
}

function tryExtractFindUniqueDescriptor(args, cacheKey) {
  if (!hasExactKeys(args, ['where', 'select'])) {
    return undefined
  }

  const where = args.where
  if (!isDescriptorRecord(where) || !hasExactKeys(where, ['id']) || typeof where.id !== 'number') {
    return undefined
  }

  const select = args.select
  if (!isDescriptorRecord(select) || !hasExactKeys(select, ['id', 'email', 'name'])) {
    return undefined
  }

  if (select.id !== true || select.email !== true || select.name !== true) {
    return undefined
  }

  return { cacheKey, placeholderValues: { '%1': where.id } }
}

function tryExtractBlogPostPageDescriptor(args, cacheKey) {
  if (!hasExactKeys(args, ['where', 'select'])) {
    return undefined
  }

  const where = args.where
  if (!isDescriptorRecord(where) || !hasExactKeys(where, ['id']) || typeof where.id !== 'number') {
    return undefined
  }

  const select = args.select
  if (!isDescriptorRecord(select) || !hasExactKeys(select, blogPageRootSelectKeys)) {
    return undefined
  }

  for (const field of blogPageRootScalarFields) {
    if (select[field] !== true) {
      return undefined
    }
  }

  if (
    !matchesSelectObject(select.author, blogPageUserSelectKeys) ||
    !matchesSelectObject(select.category, blogPageSlugSelectKeys) ||
    !matchesBlogPageTagsSelection(select.tags) ||
    !matchesBlogPageCommentsSelection(select.comments) ||
    !matchesSelectObject(select._count, blogPageCountSelectKeys)
  ) {
    return undefined
  }

  return { cacheKey, placeholderValues: { '%1': where.id } }
}

function matchesBlogPageTagsSelection(value) {
  if (!isDescriptorRecord(value) || !hasExactKeys(value, ['select'])) {
    return false
  }

  const select = value.select
  if (!isDescriptorRecord(select) || !hasExactKeys(select, ['tag'])) {
    return false
  }

  return matchesSelectObject(select.tag, blogPageSlugSelectKeys)
}

function matchesBlogPageCommentsSelection(value) {
  if (!isDescriptorRecord(value) || !hasExactKeys(value, ['take', 'orderBy', 'select']) || value.take !== 10) {
    return false
  }

  const orderBy = value.orderBy
  if (!Array.isArray(orderBy) || orderBy.length !== 1) {
    return false
  }

  const firstOrderBy = orderBy[0]
  if (!isDescriptorRecord(firstOrderBy) || !hasExactKeys(firstOrderBy, ['createdAt']) || firstOrderBy.createdAt !== 'desc') {
    return false
  }

  const select = value.select
  if (!isDescriptorRecord(select) || !hasExactKeys(select, blogPageCommentSelectKeys)) {
    return false
  }

  return select.id === true && select.content === true && select.createdAt === true && matchesSelectObject(select.author, blogPageUserSelectKeys)
}

function matchesSelectObject(value, keys) {
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

function buildLazyStaticDescriptor(args, cacheKey, placeholderValues) {
  const placeholdersByValue = new Map()
  for (const name of Object.keys(placeholderValues)) {
    const key = lazyDescriptorValueKey(placeholderValues[name])
    if (key !== undefined) {
      placeholdersByValue.set(key, name)
    }
  }

  return { cacheKey, root: buildLazyDescriptorNode(args, placeholdersByValue) }
}

function buildLazyDescriptorNode(value, placeholdersByValue) {
  const valueKey = lazyDescriptorValueKey(value)
  const placeholderName = valueKey === undefined ? undefined : placeholdersByValue.get(valueKey)
  if (placeholderName !== undefined) {
    return { kind: 'placeholder', name: placeholderName, valueType: value === null ? 'null' : typeof value }
  }

  if (Array.isArray(value)) {
    return { kind: 'array', items: value.map((item) => buildLazyDescriptorNode(item, placeholdersByValue)) }
  }

  if (isDescriptorRecord(value)) {
    const keys = Object.keys(value)
    const fields = {}
    for (const key of keys) {
      fields[key] = buildLazyDescriptorNode(value[key], placeholdersByValue)
    }
    return { kind: 'object', keys, fields }
  }

  return { kind: 'constant', value }
}

function tryExtractLazyStaticDescriptor(descriptor, args) {
  const placeholderValues = {}
  if (!matchesLazyDescriptorNode(descriptor.root, args, placeholderValues)) {
    return undefined
  }

  return { cacheKey: descriptor.cacheKey, placeholderValues }
}

function matchesLazyDescriptorNode(descriptor, value, placeholderValues) {
  switch (descriptor.kind) {
    case 'constant':
      return Object.is(value, descriptor.value)
    case 'placeholder':
      if ((value === null ? 'null' : typeof value) !== descriptor.valueType) {
        return false
      }
      if (Object.hasOwn(placeholderValues, descriptor.name)) {
        return Object.is(placeholderValues[descriptor.name], value)
      }
      placeholderValues[descriptor.name] = value
      return true
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

function lazyDescriptorValueKey(value) {
  switch (typeof value) {
    case 'string':
      return 'string:' + value
    case 'number':
      return Number.isFinite(value) ? 'number:' + value : undefined
    case 'boolean':
      return 'boolean:' + (value ? 'true' : 'false')
    case 'bigint':
      return 'bigint:' + value
    default:
      return undefined
  }
}

function isDescriptorRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value, expectedKeys) {
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

function checksumResult(result) {
  if (result == null) {
    return 0
  }

  let checksum = 1
  for (const key of Object.keys(result)) {
    const value = result[key]
    if (Array.isArray(value)) {
      checksum += value.length
    } else if (value && typeof value === 'object') {
      checksum++
    } else if (value !== null && value !== undefined) {
      checksum++
    }
  }

  return checksum
}

function executeClientScenario(client, scenario, iteration) {
  switch (scenario) {
    case 'find-unique':
      return client.user.findUnique(createClientArgs(scenario, iteration))
    case 'find-unique-batched':
      return Promise.all([
        client.user.findUnique(createFindUniqueArgs(iteration * 2)),
        client.user.findUnique(createFindUniqueArgs(iteration * 2 + 1)),
      ])
    case 'blog-page':
    case 'blog-page-by-id':
      return client.post.findUnique(createClientArgs(scenario, iteration))
    default:
      throw new Error('Unknown client-execute scenario: ' + scenario)
  }
}

function clientMethodForScenario(scenario) {
  switch (scenario) {
    case 'find-unique':
      return 'user.findUnique'
    case 'blog-page':
    case 'blog-page-by-id':
      return 'post.findUnique'
    default:
      throw new Error('Unknown client scenario: ' + scenario)
  }
}

function createQuery(scenario, iteration) {
  switch (scenario) {
    case 'find-unique':
      return createFindUniqueQuery(iteration)
    case 'user-scalar-selection':
      return createFindManyQuery((iteration % 1023) + 1)
    case 'blog-page':
      return createBlogPostPageQuery((iteration % ((1 << postScalarFields.length) - 1)) + 1)
    case 'blog-page-by-id':
      return createBlogPostPageByIdQuery(iteration + 1)
    default:
      throw new Error('Unknown scenario: ' + scenario)
  }
}

function parameterizeQueryForClientCache(query) {
  if (
    query.action === 'findUnique' &&
    query.query?.arguments?.where?.id !== undefined &&
    (query.modelName === 'User' || query.modelName === 'Post')
  ) {
    return {
      ...query,
      query: {
        ...query.query,
        arguments: {
          ...query.query.arguments,
          where: {
            ...query.query.arguments.where,
            id: createParam('%1', 'Int'),
          },
        },
      },
    }
  }

  return query
}

function collectCacheKeyBreakdown(keys) {
  let totalBytes = 0
  for (const key of keys) {
    totalBytes += key.length
  }

  const uniqueKeys = new Set(keys)
  let uniqueBytes = 0
  for (const key of uniqueKeys) {
    uniqueBytes += key.length
  }

  const commonPrefixBytes = commonPrefixLength(keys)
  const commonSuffixBytes = commonSuffixLength(keys, commonPrefixBytes)
  let prefixSuffixBytes = 0
  if (keys.length > 0) {
    prefixSuffixBytes = commonPrefixBytes + commonSuffixBytes
    for (const key of keys) {
      prefixSuffixBytes += key.length - commonPrefixBytes - commonSuffixBytes
    }
  }

  return {
    keyCount: keys.length,
    uniqueKeyCount: uniqueKeys.size,
    totalBytes,
    uniqueBytes,
    commonPrefixBytes,
    commonSuffixBytes,
    prefixSuffixBytes,
    trieBytes: countTrieBytes(keys),
    commonPrefixSample: keys[0]?.slice(0, commonPrefixBytes) ?? '',
    commonSuffixSample: commonSuffixBytes === 0 ? '' : (keys[0]?.slice(-commonSuffixBytes) ?? ''),
  }
}

function commonPrefixLength(values) {
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

function commonSuffixLength(values, commonPrefixBytes) {
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

function countTrieBytes(keys) {
  const root = new Map()
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

function retainedPlanSize() {
  let cacheKeyBytes = 0
  let planSerializedBytes = 0
  const cacheKeys = []

  for (const [key, plan] of retainedPlans) {
    cacheKeyBytes += key.length
    cacheKeys.push(key)
    planSerializedBytes += JSON.stringify(plan).length
  }

  return { cacheKeyBytes, cacheKeyBreakdown: collectCacheKeyBreakdown(cacheKeys), planSerializedBytes }
}

function runScenario(scenario, iterations, retain) {
  const compiler = getCompiler()
  let totalPlanBytes = 0
  const compileStart = performance.now()

  for (let i = 0; i < iterations; i++) {
    const query = createQuery(scenario, i)
    const queryPart = JSON.stringify(query.query)
    const request = JSON.stringify(query)
    const plan = compiler.compile(request)
    totalPlanBytes += JSON.stringify(plan).length

    if (retain) {
      retainedPlans.set(getSingleQueryCacheKey(query, queryPart), plan)
    }
  }

  const retained = retainedPlanSize()
  return {
    scenario,
    mode: 'compile',
    iterations,
    retain,
    initMs,
    compileMs: performance.now() - compileStart,
    cacheHits: 0,
    cacheMisses: iterations,
    retainedEntries: retainedPlans.size,
    retainedCacheKeyBytes: retained.cacheKeyBytes,
    retainedCacheKeyBreakdown: retained.cacheKeyBreakdown,
    retainedPlanSerializedBytes: retained.planSerializedBytes,
    averagePlanBytes: totalPlanBytes / iterations,
    runtime: navigator.userAgent,
  }
}

function runClientCacheScenario(scenario, iterations, retain) {
  const compiler = getCompiler()
  let totalPlanBytes = 0
  let cacheHits = 0
  let cacheMisses = 0
  const compileStart = performance.now()

  for (let i = 0; i < iterations; i++) {
    const query = parameterizeQueryForClientCache(createQuery(scenario, i))
    const queryPart = JSON.stringify(query.query)
    const cacheKey = getSingleQueryCacheKey(query, queryPart)
    let plan = retainedPlans.get(cacheKey)

    if (plan === undefined) {
      cacheMisses++
      plan = compiler.compile(getSingleQueryRequest(query, queryPart))
      if (retain) {
        retainedPlans.set(cacheKey, plan)
      }
    } else {
      cacheHits++
    }

    totalPlanBytes += JSON.stringify(plan).length
  }

  const retained = retainedPlanSize()
  return {
    scenario,
    mode: 'client-cache',
    iterations,
    retain,
    initMs,
    compileMs: performance.now() - compileStart,
    cacheHits,
    cacheMisses,
    retainedEntries: retainedPlans.size,
    retainedCacheKeyBytes: retained.cacheKeyBytes,
    retainedCacheKeyBreakdown: retained.cacheKeyBreakdown,
    retainedPlanSerializedBytes: retained.planSerializedBytes,
    averagePlanBytes: totalPlanBytes / iterations,
    runtime: navigator.userAgent,
  }
}

function runClientCacheKeyScenario(scenario, iterations) {
  const compiler = getCompiler()
  const warmQuery = parameterizeQueryForClientCache(createQuery(scenario, 0))
  const warmQueryPart = JSON.stringify(warmQuery.query)
  const warmCacheKey = getSingleQueryCacheKey(warmQuery, warmQueryPart)
  retainedPlans.set(warmCacheKey, compiler.compile(getSingleQueryRequest(warmQuery, warmQueryPart)))

  let cacheHits = 0
  let checksum = 0
  const start = performance.now()

  for (let i = 0; i < iterations; i++) {
    const query = parameterizeQueryForClientCache(createQuery(scenario, i))
    const queryPart = JSON.stringify(query.query)
    const cacheKey = getSingleQueryCacheKey(query, queryPart)
    const plan = retainedPlans.get(cacheKey)

    if (plan !== undefined) {
      cacheHits++
      checksum += 1
    }
  }

  const elapsedMs = performance.now() - start
  const retained = retainedPlanSize()
  return {
    scenario,
    mode: 'client-cache-key',
    iterations,
    retain: true,
    initMs,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / iterations,
    cacheHits,
    cacheMisses: iterations - cacheHits,
    checksum,
    retainedEntries: retainedPlans.size,
    retainedCacheKeyBytes: retained.cacheKeyBytes,
    retainedCacheKeyBreakdown: retained.cacheKeyBreakdown,
    retainedPlanSerializedBytes: retained.planSerializedBytes,
    averagePlanBytes: 0,
    runtime: navigator.userAgent,
  }
}

function runDescriptorExtractScenario(scenario, iterations, kind) {
  const firstArgs = createClientArgs(scenario, 0)
  const cacheKey = 'descriptor:' + scenario
  const lazyDescriptor =
    kind === 'lazy' ? buildLazyStaticDescriptor(firstArgs, cacheKey, { '%1': firstArgs.where.id }) : undefined

  const firstExtraction =
    kind === 'lazy'
      ? tryExtractLazyStaticDescriptor(lazyDescriptor, firstArgs)
      : tryExtractStaticDescriptor(scenario, firstArgs, cacheKey)
  if (firstExtraction === undefined) {
    throw new Error('Expected descriptor to match first args for scenario ' + scenario)
  }

  let checksum = 0
  const start = performance.now()

  for (let i = 0; i < iterations; i++) {
    const args = createClientArgs(scenario, i)
    const extraction =
      kind === 'lazy'
        ? tryExtractLazyStaticDescriptor(lazyDescriptor, args)
        : tryExtractStaticDescriptor(scenario, args, cacheKey)

    if (extraction === undefined) {
      throw new Error('Expected descriptor to match benchmark args for scenario ' + scenario)
    }

    checksum += extraction.cacheKey.length
    checksum += extraction.placeholderValues['%1'] === undefined ? 0 : 1
  }

  const elapsedMs = performance.now() - start
  const retained = retainedPlanSize()
  return {
    scenario,
    mode: 'client-' + kind + '-descriptor-extract',
    iterations,
    retain: false,
    initMs,
    elapsedMs,
    averageUs: (elapsedMs * 1000) / iterations,
    cacheHits: iterations,
    cacheMisses: 0,
    checksum,
    retainedEntries: retainedPlans.size,
    retainedCacheKeyBytes: retained.cacheKeyBytes,
    retainedCacheKeyBreakdown: retained.cacheKeyBreakdown,
    retainedPlanSerializedBytes: retained.planSerializedBytes,
    averagePlanBytes: 0,
    runtime: navigator.userAgent,
  }
}

async function runClientPrecomputedScenario(scenario, iterations, variant) {
  const Client = getPrismaClientConstructor()
  const client = new Client({
    adapter: createAdapterFactory(),
    queryPlanCacheMaxSize: 100,
  })
  const startInit = performance.now()
  await client.$connect()

  try {
    await executeClientScenario(client, scenario, 0)

    const firstArgs = createClientArgs(scenario, 0)
    const warmQuery = parameterizeQueryForClientCache(createClientProtocolQuery(scenario, 0))
    const warmQueryPart = JSON.stringify(warmQuery.query)
    const cacheKey = getSingleQueryCacheKey(warmQuery, warmQueryPart)
    const descriptor = buildLazyStaticDescriptor(firstArgs, cacheKey, { '%1': firstArgs.where.id })
    const staticProtocolQuery = createClientProtocolQuery(scenario, 0)
    const clientMethod = clientMethodForScenario(scenario)
    const requestBase = {
      action: staticProtocolQuery.action,
      model: staticProtocolQuery.modelName,
      clientMethod,
      dataPath: [],
    }
    const requestHandlerBase = {
      protocolQuery: staticProtocolQuery,
      modelName: staticProtocolQuery.modelName,
      action: staticProtocolQuery.action,
      dataPath: [],
      clientMethod,
      extensions: client._extensions,
    }
    const usesStaticProtocol = variant !== 'internal-precomputed-protocol'

    resetCounts()
    let checksum = 0
    const start = performance.now()

    for (let i = 0; i < iterations; i++) {
      const args = createClientArgs(scenario, i)
      const extraction = tryExtractLazyStaticDescriptor(descriptor, args)
      if (extraction === undefined) {
        throw new Error('Expected lazy descriptor to match benchmark args for scenario ' + scenario)
      }

      const protocolQuery = usesStaticProtocol ? staticProtocolQuery : createClientProtocolQuery(scenario, i)
      let result
      switch (variant) {
        case 'internal-precomputed-protocol':
        case 'internal-precomputed-static-protocol':
          result = await client._request({
            ...requestBase,
            args,
            protocolQuery,
            precomputedQueryPlanCacheHit: extraction,
          })
          break
        case 'request-handler-precomputed-static-protocol':
          result = await client._requestHandler.request({
            ...requestHandlerBase,
            args,
            precomputedQueryPlanCacheHit: extraction,
          })
          break
        case 'engine-precomputed-static-protocol':
          result = (
            await client._engine.request(staticProtocolQuery, {
              isWrite: false,
              precomputedQueryPlanCacheHit: extraction,
            })
          ).data[staticProtocolQuery.action]
          break
        case 'prisma-promise-engine-precomputed-static-protocol':
          result = await client._createPrismaPromise(
            () =>
              client._engine
                .request(staticProtocolQuery, {
                  isWrite: false,
                  precomputedQueryPlanCacheHit: extraction,
                })
                .then((response) => response.data[staticProtocolQuery.action]),
            {
              action: staticProtocolQuery.action,
              args,
              model: staticProtocolQuery.modelName,
            },
          )
          break
        default:
          throw new Error('Unknown precomputed variant: ' + variant)
      }

      checksum += checksumResult(result)
    }

    const elapsedMs = performance.now() - start
    const compileCount = counts.compile + counts.compileBatch
    const retained = retainedPlanSize()

    return {
      scenario,
      mode: 'client-' + variant,
      iterations,
      retain: true,
      initMs: performance.now() - startInit - elapsedMs,
      elapsedMs,
      averageUs: (elapsedMs * 1000) / iterations,
      cacheHits: Math.max(0, iterations - compileCount),
      cacheMisses: compileCount,
      compileCount: counts.compile,
      compileBatchCount: counts.compileBatch,
      queryRawCount: counts.queryRaw,
      executeRawCount: counts.executeRaw,
      checksum,
      retainedEntries: retainedPlans.size,
      retainedCacheKeyBytes: retained.cacheKeyBytes,
      retainedCacheKeyBreakdown: retained.cacheKeyBreakdown,
      retainedPlanSerializedBytes: retained.planSerializedBytes,
      averagePlanBytes: 0,
      runtime: navigator.userAgent,
    }
  } finally {
    await client.$disconnect()
  }
}

async function runClientExecuteScenario(scenario, iterations, retain, precomputedFastPath) {
  const usesPrecomputedFastPath = precomputedFastPath !== undefined
  const Client = getPrismaClientConstructor()
  const client = new Client({
    adapter: createAdapterFactory(),
    queryPlanCacheMaxSize: retain ? 100 : 0,
    __internal: usesPrecomputedFastPath
      ? {
          enginePrecomputedFastPath: precomputedFastPath === 'engine',
          requestPrecomputedFastPath: precomputedFastPath === 'request',
        }
      : undefined,
  })
  if (usesPrecomputedFastPath) {
    const request = client._engine.request.bind(client._engine)
    client._engine.request = (query, options) => {
      if (options.precomputedQueryPlanCacheHit !== undefined) {
        counts.precomputedFastPathHits++
      }
      return request(query, options)
    }

    const requestWithPrecomputedQueryPlanCacheHit = client._engine.requestWithPrecomputedQueryPlanCacheHit.bind(client._engine)
    client._engine.requestWithPrecomputedQueryPlanCacheHit = (query, options) => {
      counts.precomputedFastPathLearns++
      return requestWithPrecomputedQueryPlanCacheHit(query, options)
    }

    const requestBatch = client._engine.requestBatch.bind(client._engine)
    client._engine.requestBatch = (queries, options) => {
      if (Array.isArray(options.precomputedQueryPlanCacheHits)) {
        counts.precomputedBatchHits += options.precomputedQueryPlanCacheHits.length
      }
      return requestBatch(queries, options)
    }
  }
  const startInit = performance.now()
  await client.$connect()

  try {
    if (retain) {
      await executeClientScenario(client, scenario, 0)
    }

    resetCounts()
    let checksum = 0
    const start = performance.now()

    for (let i = 0; i < iterations; i++) {
      checksum += checksumResult(await executeClientScenario(client, scenario, i))
    }

    const elapsedMs = performance.now() - start
    const compileCount = counts.compile + counts.compileBatch

    return {
      scenario,
      mode:
        precomputedFastPath === 'engine'
          ? 'client-execute-engine-precomputed-fast-path'
          : precomputedFastPath === 'request'
            ? 'client-execute-request-precomputed-fast-path'
            : 'client-execute',
      iterations,
      retain,
      initMs: performance.now() - startInit - elapsedMs,
      elapsedMs,
      averageUs: (elapsedMs * 1000) / iterations,
      cacheHits: retain ? Math.max(0, iterations - compileCount) : 0,
      cacheMisses: compileCount,
      compileCount: counts.compile,
      compileBatchCount: counts.compileBatch,
      queryRawCount: counts.queryRaw,
      executeRawCount: counts.executeRaw,
      precomputedFastPathHits: usesPrecomputedFastPath ? counts.precomputedFastPathHits : undefined,
      precomputedFastPathLearns: usesPrecomputedFastPath ? counts.precomputedFastPathLearns : undefined,
      precomputedBatchHits: usesPrecomputedFastPath ? counts.precomputedBatchHits : undefined,
      checksum,
      retainedEntries: 0,
      retainedCacheKeyBytes: 0,
      retainedCacheKeyBreakdown: collectCacheKeyBreakdown([]),
      retainedPlanSerializedBytes: 0,
      averagePlanBytes: 0,
      runtime: navigator.userAgent,
    }
  } finally {
    await client.$disconnect()
  }
}

export default {
  async fetch(request) {
    try {
      const url = new URL(request.url)

      if (url.pathname === '/clear') {
        retainedPlans.clear()
        return Response.json({ ok: true, retainedEntries: retainedPlans.size })
      }

      const scenario = url.searchParams.get('scenario') ?? 'find-unique'
      const iterations = Number(url.searchParams.get('iterations') ?? '1')
      const retain = url.searchParams.get('retain') === 'true'
      const mode = url.searchParams.get('mode') ?? 'compile'

      let result
      if (mode === 'client-execute') {
        result = await runClientExecuteScenario(scenario, iterations, retain)
      } else if (mode === 'client-execute-engine-precomputed-fast-path') {
        result = await runClientExecuteScenario(scenario, iterations, retain, 'engine')
      } else if (mode === 'client-execute-request-precomputed-fast-path') {
        result = await runClientExecuteScenario(scenario, iterations, retain, 'request')
      } else if (mode === 'client-cache') {
        result = runClientCacheScenario(scenario, iterations, retain)
      } else if (mode === 'client-cache-key') {
        result = runClientCacheKeyScenario(scenario, iterations)
      } else if (mode === 'client-static-descriptor-extract') {
        result = runDescriptorExtractScenario(scenario, iterations, 'static')
      } else if (mode === 'client-lazy-descriptor-extract') {
        result = runDescriptorExtractScenario(scenario, iterations, 'lazy')
      } else if (
        mode === 'client-internal-precomputed-protocol' ||
        mode === 'client-internal-precomputed-static-protocol' ||
        mode === 'client-request-handler-precomputed-static-protocol' ||
        mode === 'client-engine-precomputed-static-protocol' ||
        mode === 'client-prisma-promise-engine-precomputed-static-protocol'
      ) {
        result = await runClientPrecomputedScenario(scenario, iterations, mode.slice('client-'.length))
      } else {
        result = runScenario(scenario, iterations, retain)
      }

      return Response.json({ ok: true, result })
    } catch (error) {
      return Response.json({ ok: false, message: error?.message, stack: error?.stack }, { status: 500 })
    }
  },
}
`
}

async function createMiniflare(config: {
  runtimeDataModel: RuntimeDataModel
  parameterizationSchema: SerializedParamGraph
}): Promise<MiniflareInstance | undefined> {
  const Miniflare = await loadMiniflare()

  if (Miniflare === undefined) {
    return undefined
  }

  return new Miniflare({
    modules: [
      { type: 'ESModule', path: 'worker.mjs', contents: buildWorkerModule(config) },
      { type: 'ESModule', path: 'query_compiler_fast_bg.sqlite.mjs', contents: loadRuntimeModuleContents() },
      { type: 'ESModule', path: 'wasm-compiler-edge.mjs', contents: fs.readFileSync(WASM_COMPILER_EDGE_PATH, 'utf-8') },
      {
        type: 'ESModule',
        path: '@prisma/client-runtime-utils',
        contents: fs.readFileSync(CLIENT_RUNTIME_UTILS_PATH, 'utf-8'),
      },
      { type: 'CompiledWasm', path: 'query_compiler_fast_bg.sqlite.wasm', contents: await loadWasmBytes() },
    ],
    modulesRoot: '.',
    compatibilityDate: '2025-01-01',
  })
}

async function dispatchRun(
  mf: MiniflareInstance,
  label: string,
  scenario: string,
  iterations: number,
  retain: boolean,
  mode = 'compile',
): Promise<Measurement> {
  const before = memorySnapshot()
  const started = performance.now()
  const response = await mf.dispatchFetch(
    `http://query-compiler.test/?scenario=${scenario}&iterations=${iterations}&retain=${retain}&mode=${mode}`,
  )
  const body = (await response.json()) as
    | { ok: true; result: WorkerRunResult }
    | { ok: false; message: string; stack?: string }
  const hostElapsedMs = performance.now() - started

  if (!body.ok) {
    throw new Error(body.stack ?? body.message)
  }

  const after = memorySnapshot()
  return {
    label,
    worker: body.result,
    hostElapsedMs,
    hostMemory: {
      before,
      after,
      delta: memoryDelta(before, after),
    },
  }
}

async function clearWorkerCache(mf: MiniflareInstance): Promise<void> {
  const response = await mf.dispatchFetch('http://query-compiler.test/clear')
  const body = (await response.json()) as { ok: boolean; message?: string }

  if (!body.ok) {
    throw new Error(body.message ?? 'Failed to clear worker cache')
  }
}

function printMeasurement(measurement: Measurement): void {
  const { label, worker, hostMemory } = measurement

  console.log(label)
  console.log(`  runtime: ${worker.runtime}`)
  console.log(`  mode: ${worker.mode}`)
  console.log(
    `  host dispatch: ${formatMs(measurement.hostElapsedMs)} total, ${(
      (measurement.hostElapsedMs * 1000) /
      worker.iterations
    ).toFixed(2)} us/op`,
  )
  console.log(`  compiler init: ${formatMs(worker.initMs)}`)
  if (worker.compileMs !== undefined) {
    console.log(`  compile loop: ${formatMs(worker.compileMs)} for ${worker.iterations} ${worker.scenario} queries`)
  }
  if (worker.elapsedMs !== undefined && worker.averageUs !== undefined) {
    if (worker.elapsedMs === 0) {
      console.log(
        `  request loop: below worker timer resolution for ${worker.iterations} ${worker.scenario} requests; use host dispatch as upper-bound timing`,
      )
    } else {
      console.log(
        `  request loop: ${formatMs(worker.elapsedMs)} for ${worker.iterations} ${worker.scenario} requests, ${worker.averageUs.toFixed(
          2,
        )} us/op`,
      )
    }
  }
  console.log(`  cache hits/misses: ${worker.cacheHits}/${worker.cacheMisses}`)
  if (worker.compileCount !== undefined) {
    console.log(
      `  operations: compiles ${worker.compileCount}, compileBatch ${worker.compileBatchCount}, queryRaw ${worker.queryRawCount}, executeRaw ${worker.executeRawCount}, checksum ${worker.checksum}`,
    )
  }
  if (worker.precomputedFastPathHits !== undefined) {
    console.log(
      `  precomputed fast path: hits ${worker.precomputedFastPathHits}, learns ${worker.precomputedFastPathLearns}`,
    )
  }
  if (worker.precomputedBatchHits !== undefined) {
    console.log(`  precomputed batch: hits ${worker.precomputedBatchHits}`)
  }
  console.log(`  average serialized plan: ${formatBytes(worker.averagePlanBytes)}`)
  console.log(
    `  retained in worker: ${worker.retainedEntries} entries, ${formatBytes(worker.retainedCacheKeyBytes)} keys, ${formatBytes(
      worker.retainedPlanSerializedBytes,
    )} serialized plans`,
  )
  printCacheKeyBreakdown(worker.retainedCacheKeyBreakdown)
  console.log(
    `  host delta: rss ${formatBytes(hostMemory.delta.rss)}, heap ${formatBytes(hostMemory.delta.heapUsed)}, external ${formatBytes(
      hostMemory.delta.external,
    )}, arrayBuffers ${formatBytes(hostMemory.delta.arrayBuffers)}`,
  )
}

function printCacheKeyBreakdown(breakdown: CacheKeyBreakdown | undefined): void {
  if (breakdown === undefined || breakdown.keyCount === 0) {
    return
  }

  const prefixSuffixSavings = breakdown.totalBytes - breakdown.prefixSuffixBytes
  const trieSavings = breakdown.totalBytes - breakdown.trieBytes

  console.log(
    [
      `  key shape: keys=${breakdown.keyCount}`,
      `unique=${breakdown.uniqueKeyCount}`,
      `uniqueTotal=${formatBytes(breakdown.uniqueBytes)}`,
      `commonPrefix=${formatBytes(breakdown.commonPrefixBytes)}`,
      `commonSuffix=${formatBytes(breakdown.commonSuffixBytes)}`,
      `prefixSuffixBytes=${formatBytes(breakdown.prefixSuffixBytes)}`,
      `prefixSuffixSavings=${formatBytes(prefixSuffixSavings)}`,
      `trieBytes=${formatBytes(breakdown.trieBytes)}`,
      `trieSavings=${formatBytes(trieSavings)}`,
      `trieSavingsShare=${
        breakdown.totalBytes === 0 ? '0.0%' : `${((trieSavings / breakdown.totalBytes) * 100).toFixed(1)}%`
      }`,
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

async function run(): Promise<void> {
  const dmmf = await getDMMF({ datamodel: BENCHMARK_DATAMODEL })
  const config = {
    runtimeDataModel: dmmfToRuntimeDataModel(dmmf.datamodel),
    parameterizationSchema: buildAndSerializeParamGraph(dmmf),
  }
  const mf = await createMiniflare(config)

  if (mf === undefined) {
    return
  }

  try {
    console.log('Workerd query compiler memory probe')
    console.log(
      'Host RSS includes Miniflare/workerd process effects. Use this as a closer edge-runtime signal, not as an exact Cloudflare isolate heap measurement.',
    )
    console.log('')

    printMeasurement(await dispatchRun(mf, 'cold smoke compile', 'find-unique', 1, false))
    console.log('')

    await clearWorkerCache(mf)
    printMeasurement(await dispatchRun(mf, 'retained scalar plan cache', 'user-scalar-selection', 100, true))
    console.log('')

    await clearWorkerCache(mf)
    printMeasurement(await dispatchRun(mf, 'retained blog-page plan cache', 'blog-page', 100, true))
    console.log('')

    await clearWorkerCache(mf)
    printMeasurement(
      await dispatchRun(mf, 'client-cache findUnique value churn', 'find-unique', 100, true, 'client-cache'),
    )
    console.log('')

    await clearWorkerCache(mf)
    printMeasurement(
      await dispatchRun(mf, 'client-cache blog-page value churn', 'blog-page-by-id', 100, true, 'client-cache'),
    )
    console.log('')

    await clearWorkerCache(mf)
    printMeasurement(
      await dispatchRun(
        mf,
        'client-cache-key findUnique value churn',
        'find-unique',
        CLIENT_CACHE_KEY_ITERATIONS,
        true,
        'client-cache-key',
      ),
    )
    console.log('')

    await clearWorkerCache(mf)
    printMeasurement(
      await dispatchRun(
        mf,
        'client-cache-key blog-page value churn',
        'blog-page-by-id',
        CLIENT_CACHE_KEY_ITERATIONS,
        true,
        'client-cache-key',
      ),
    )

    console.log('')

    await clearWorkerCache(mf)
    printMeasurement(
      await dispatchRun(
        mf,
        'client-static-descriptor-extract findUnique value churn',
        'find-unique',
        DESCRIPTOR_ITERATIONS,
        false,
        'client-static-descriptor-extract',
      ),
    )
    console.log('')

    await clearWorkerCache(mf)
    printMeasurement(
      await dispatchRun(
        mf,
        'client-static-descriptor-extract blog-page value churn',
        'blog-page-by-id',
        DESCRIPTOR_ITERATIONS,
        false,
        'client-static-descriptor-extract',
      ),
    )
    console.log('')

    await clearWorkerCache(mf)
    printMeasurement(
      await dispatchRun(
        mf,
        'client-lazy-descriptor-extract findUnique value churn',
        'find-unique',
        DESCRIPTOR_ITERATIONS,
        false,
        'client-lazy-descriptor-extract',
      ),
    )
    console.log('')

    await clearWorkerCache(mf)
    printMeasurement(
      await dispatchRun(
        mf,
        'client-lazy-descriptor-extract blog-page value churn',
        'blog-page-by-id',
        DESCRIPTOR_ITERATIONS,
        false,
        'client-lazy-descriptor-extract',
      ),
    )
  } finally {
    await mf.dispose()
  }

  const clientMf = await createMiniflare(config)

  if (clientMf === undefined) {
    return
  }

  try {
    const precomputedMeasurements = [
      [
        'client-internal-precomputed-protocol findUnique value churn',
        'find-unique',
        'client-internal-precomputed-protocol',
      ],
      [
        'client-internal-precomputed-protocol blog-page value churn',
        'blog-page-by-id',
        'client-internal-precomputed-protocol',
      ],
      [
        'client-internal-precomputed-static-protocol findUnique value churn',
        'find-unique',
        'client-internal-precomputed-static-protocol',
      ],
      [
        'client-internal-precomputed-static-protocol blog-page value churn',
        'blog-page-by-id',
        'client-internal-precomputed-static-protocol',
      ],
      [
        'client-request-handler-precomputed-static-protocol findUnique value churn',
        'find-unique',
        'client-request-handler-precomputed-static-protocol',
      ],
      [
        'client-request-handler-precomputed-static-protocol blog-page value churn',
        'blog-page-by-id',
        'client-request-handler-precomputed-static-protocol',
      ],
      [
        'client-engine-precomputed-static-protocol findUnique value churn',
        'find-unique',
        'client-engine-precomputed-static-protocol',
      ],
      [
        'client-engine-precomputed-static-protocol blog-page value churn',
        'blog-page-by-id',
        'client-engine-precomputed-static-protocol',
      ],
      [
        'client-prisma-promise-engine-precomputed-static-protocol findUnique value churn',
        'find-unique',
        'client-prisma-promise-engine-precomputed-static-protocol',
      ],
      [
        'client-prisma-promise-engine-precomputed-static-protocol blog-page value churn',
        'blog-page-by-id',
        'client-prisma-promise-engine-precomputed-static-protocol',
      ],
    ] as const

    for (const [label, scenario, mode] of precomputedMeasurements) {
      console.log('')
      await clearWorkerCache(clientMf)
      printMeasurement(await dispatchRun(clientMf, label, scenario, PRECOMPUTED_ITERATIONS, false, mode))
    }

    console.log('')
    printMeasurement(
      await dispatchRun(
        clientMf,
        'generated client findUnique warmed cache',
        'find-unique',
        GENERATED_FIND_UNIQUE_ITERATIONS,
        true,
        'client-execute',
      ),
    )
    console.log('')
    printMeasurement(
      await dispatchRun(
        clientMf,
        'generated client engine precomputed fast path findUnique warmed cache',
        'find-unique',
        GENERATED_FIND_UNIQUE_ITERATIONS,
        true,
        'client-execute-engine-precomputed-fast-path',
      ),
    )
    console.log('')
    printMeasurement(
      await dispatchRun(
        clientMf,
        'generated client request precomputed fast path findUnique warmed cache',
        'find-unique',
        GENERATED_FIND_UNIQUE_ITERATIONS,
        true,
        'client-execute-request-precomputed-fast-path',
      ),
    )
    console.log('')
    printMeasurement(
      await dispatchRun(
        clientMf,
        'generated client batched findUnique warmed cache',
        'find-unique-batched',
        GENERATED_FIND_UNIQUE_ITERATIONS,
        true,
        'client-execute',
      ),
    )
    console.log('')
    printMeasurement(
      await dispatchRun(
        clientMf,
        'generated client engine precomputed fast path batched findUnique warmed cache',
        'find-unique-batched',
        GENERATED_FIND_UNIQUE_ITERATIONS,
        true,
        'client-execute-engine-precomputed-fast-path',
      ),
    )
    console.log('')
    printMeasurement(
      await dispatchRun(
        clientMf,
        'generated client request precomputed fast path batched findUnique warmed cache',
        'find-unique-batched',
        GENERATED_FIND_UNIQUE_ITERATIONS,
        true,
        'client-execute-request-precomputed-fast-path',
      ),
    )
    console.log('')
    printMeasurement(
      await dispatchRun(
        clientMf,
        'generated client blog-page warmed cache',
        'blog-page-by-id',
        GENERATED_BLOG_PAGE_ITERATIONS,
        true,
        'client-execute',
      ),
    )
    console.log('')
    printMeasurement(
      await dispatchRun(
        clientMf,
        'generated client engine precomputed fast path blog-page warmed cache',
        'blog-page-by-id',
        GENERATED_BLOG_PAGE_ITERATIONS,
        true,
        'client-execute-engine-precomputed-fast-path',
      ),
    )
    console.log('')
    printMeasurement(
      await dispatchRun(
        clientMf,
        'generated client request precomputed fast path blog-page warmed cache',
        'blog-page-by-id',
        GENERATED_BLOG_PAGE_ITERATIONS,
        true,
        'client-execute-request-precomputed-fast-path',
      ),
    )
  } finally {
    await clientMf.dispose()
  }
}

void run().catch((error) => {
  console.error(error)
  process.exit(1)
})
