import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const BENCHMARK_DATAMODEL = fs.readFileSync(path.join(__dirname, 'schema.prisma'), 'utf-8')
const RUNTIME_BASE = path.join(__dirname, '..', '..', '..', '..', 'runtime')
const RUNTIME_PATH = path.join(RUNTIME_BASE, 'query_compiler_fast_bg.sqlite.mjs')
const WASM_BASE64_PATH = path.join(RUNTIME_BASE, 'query_compiler_fast_bg.sqlite.wasm-base64.mjs')

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

type WorkerRunResult = {
  scenario: string
  iterations: number
  retain: boolean
  initMs: number
  compileMs: number
  retainedEntries: number
  retainedCacheKeyBytes: number
  retainedPlanSerializedBytes: number
  averagePlanBytes: number
  runtime: string
}

type Measurement = {
  label: string
  worker: WorkerRunResult
  hostMemory: {
    before: MemorySnapshot
    after: MemorySnapshot
    delta: MemorySnapshot
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
  const wasmModule = (await import(pathToFileURL(WASM_BASE64_PATH).href)) as { wasm: string }
  return new Uint8Array(Buffer.from(wasmModule.wasm, 'base64'))
}

function buildWorkerModule(): string {
  return `
import * as runtime from './query_compiler_fast_bg.sqlite.mjs'
import wasmModule from './query_compiler_fast_bg.sqlite.wasm'

const datamodel = ${JSON.stringify(BENCHMARK_DATAMODEL)}
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
let initMs = 0
const retainedPlans = new Map()

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

function getStringCacheKeyPart(value) {
  if (value == null) {
    return '-1:'
  }

  return value.length + ':' + value
}

function getSingleQueryCacheKey(query, queryPart) {
  return 's:' + getStringCacheKeyPart(query.modelName) + getStringCacheKeyPart(query.action) + queryPart.length + ':' + queryPart
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

function createQuery(scenario, iteration) {
  switch (scenario) {
    case 'find-unique':
      return createFindUniqueQuery(iteration)
    case 'user-scalar-selection':
      return createFindManyQuery((iteration % 1023) + 1)
    case 'blog-page':
      return createBlogPostPageQuery((iteration % ((1 << postScalarFields.length) - 1)) + 1)
    default:
      throw new Error('Unknown scenario: ' + scenario)
  }
}

function retainedPlanSize() {
  let cacheKeyBytes = 0
  let planSerializedBytes = 0

  for (const [key, plan] of retainedPlans) {
    cacheKeyBytes += key.length
    planSerializedBytes += JSON.stringify(plan).length
  }

  return { cacheKeyBytes, planSerializedBytes }
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
    iterations,
    retain,
    initMs,
    compileMs: performance.now() - compileStart,
    retainedEntries: retainedPlans.size,
    retainedCacheKeyBytes: retained.cacheKeyBytes,
    retainedPlanSerializedBytes: retained.planSerializedBytes,
    averagePlanBytes: totalPlanBytes / iterations,
    runtime: navigator.userAgent,
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

      return Response.json({ ok: true, result: runScenario(scenario, iterations, retain) })
    } catch (error) {
      return Response.json({ ok: false, message: error?.message, stack: error?.stack }, { status: 500 })
    }
  },
}
`
}

async function createMiniflare(): Promise<MiniflareInstance | undefined> {
  const Miniflare = await loadMiniflare()

  if (Miniflare === undefined) {
    return undefined
  }

  return new Miniflare({
    modules: [
      { type: 'ESModule', path: 'worker.mjs', contents: buildWorkerModule() },
      { type: 'ESModule', path: 'query_compiler_fast_bg.sqlite.mjs', contents: fs.readFileSync(RUNTIME_PATH, 'utf-8') },
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
): Promise<Measurement> {
  const before = memorySnapshot()
  const response = await mf.dispatchFetch(
    `http://query-compiler.test/?scenario=${scenario}&iterations=${iterations}&retain=${retain}`,
  )
  const body = (await response.json()) as
    | { ok: true; result: WorkerRunResult }
    | { ok: false; message: string; stack?: string }

  if (!body.ok) {
    throw new Error(body.stack ?? body.message)
  }

  const after = memorySnapshot()
  return {
    label,
    worker: body.result,
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
  console.log(`  compiler init: ${formatMs(worker.initMs)}`)
  console.log(`  compile loop: ${formatMs(worker.compileMs)} for ${worker.iterations} ${worker.scenario} queries`)
  console.log(`  average serialized plan: ${formatBytes(worker.averagePlanBytes)}`)
  console.log(
    `  retained in worker: ${worker.retainedEntries} entries, ${formatBytes(worker.retainedCacheKeyBytes)} keys, ${formatBytes(
      worker.retainedPlanSerializedBytes,
    )} serialized plans`,
  )
  console.log(
    `  host delta: rss ${formatBytes(hostMemory.delta.rss)}, heap ${formatBytes(hostMemory.delta.heapUsed)}, external ${formatBytes(
      hostMemory.delta.external,
    )}, arrayBuffers ${formatBytes(hostMemory.delta.arrayBuffers)}`,
  )
}

async function run(): Promise<void> {
  const mf = await createMiniflare()

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
  } finally {
    await mf.dispose()
  }
}

void run().catch((error) => {
  console.error(error)
  process.exit(1)
})
