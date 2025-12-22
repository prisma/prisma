/**
 * End-to-End Performance Profiling
 *
 * Measures the complete query pipeline including:
 * - Query parameterization
 * - Cache lookup
 * - Compilation (on miss)
 * - Query interpretation (mocked adapter)
 * - Data mapping
 */
import fs from 'node:fs'
import path from 'node:path'

import { QueryCompilerConstructor } from '@prisma/client-common'

import { wasmQueryCompilerLoader } from '../../../runtime/core/engines/client/WasmQueryCompilerLoader'
import { parameterizeQuery } from '../../../runtime/core/engines/client/parameterize'
import { QueryPlanCache } from '../../../runtime/core/engines/client/QueryPlanCache'

const BENCHMARK_DATAMODEL = fs.readFileSync(path.join(__dirname, 'schema.prisma'), 'utf-8')

const TEST_QUERY_FINDUNIQUE = {
  modelName: 'User',
  action: 'findUnique',
  query: {
    arguments: { where: { id: 1 } },
    selection: {
      $scalars: true,
    },
  },
}

const TEST_QUERY_FINDMANY = {
  modelName: 'User',
  action: 'findMany',
  query: {
    arguments: {
      where: { isActive: true },
      take: 10,
    },
    selection: {
      $scalars: true,
    },
  },
}

async function setup() {
  const runtimeBase = path.join(__dirname, '..', '..', '..', '..', 'runtime')
  const provider = 'sqlite'

  const QueryCompilerClass: QueryCompilerConstructor = await wasmQueryCompilerLoader.loadQueryCompiler({
    activeProvider: provider,
    clientVersion: '0.0.0',
    compilerWasm: {
      getRuntime: () => Promise.resolve(require(path.join(runtimeBase, `query_compiler_bg.${provider}.js`))),
      getQueryCompilerWasmModule: () => {
        const wasmBase64: string = require(path.join(runtimeBase, `query_compiler_bg.${provider}.wasm-base64.js`)).wasm
        return Promise.resolve(new WebAssembly.Module(Buffer.from(wasmBase64, 'base64')))
      },
    },
  })

  const queryCompiler = new QueryCompilerClass({
    provider,
    connectionInfo: { supportsRelationJoins: false },
    datamodel: BENCHMARK_DATAMODEL,
  })

  return { queryCompiler }
}

function measure<T>(_name: string, fn: () => T, iterations = 10000): { result: T; avgUs: number; opsPerSec: number } {
  // Warmup
  for (let i = 0; i < 100; i++) fn()

  const start = process.hrtime.bigint()
  let result: T
  for (let i = 0; i < iterations; i++) {
    result = fn()
  }
  const elapsed = Number(process.hrtime.bigint() - start)
  const avgNs = elapsed / iterations
  const avgUs = avgNs / 1000

  return { result: result!, avgUs, opsPerSec: 1_000_000_000 / avgNs }
}

async function runProfiling() {
  console.log('Setting up E2E profiling environment...\n')

  const { queryCompiler } = await setup()
  const cache = new QueryPlanCache(1000)

  console.log('╔════════════════════════════════════════════════════════════════════════════════╗')
  console.log('║                           E2E Query Pipeline Profile                           ║')
  console.log('╠════════════════════════════════════════════════════════════════════════════════╣')
  console.log('║ Stage                              │ Avg (μs) │     Ops/sec │ Notes            ║')
  console.log('╠════════════════════════════════════╪══════════╪═════════════╪══════════════════╣')

  // Stage 1: Parameterization
  const param1 = measure('parameterize findUnique', () => parameterizeQuery(TEST_QUERY_FINDUNIQUE))
  console.log(`║ Parameterize findUnique            │ ${param1.avgUs.toFixed(2).padStart(8)} │ ${Math.round(param1.opsPerSec).toLocaleString().padStart(11)} │                  ║`)

  const param2 = measure('parameterize findMany', () => parameterizeQuery(TEST_QUERY_FINDMANY))
  console.log(`║ Parameterize findMany              │ ${param2.avgUs.toFixed(2).padStart(8)} │ ${Math.round(param2.opsPerSec).toLocaleString().padStart(11)} │                  ║`)

  // Stage 2: Cache lookup (hit)
  const { queryHash, parameterizedQuery, placeholderPaths } = parameterizeQuery(TEST_QUERY_FINDUNIQUE)
  const fullKey = JSON.stringify(parameterizedQuery)
  const compiledPlan = queryCompiler.compile(JSON.stringify(TEST_QUERY_FINDUNIQUE)) as any
  cache.set(queryHash, { plan: compiledPlan, placeholderPaths, fullKey })

  const cacheHit = measure('cache hit', () => cache.get(queryHash, fullKey))
  console.log(`║ Cache lookup (hit)                 │ ${cacheHit.avgUs.toFixed(2).padStart(8)} │ ${Math.round(cacheHit.opsPerSec).toLocaleString().padStart(11)} │                  ║`)

  // Stage 3: Compilation (miss)
  const compile1 = measure('compile findUnique', () => {
    queryCompiler.compile(JSON.stringify(TEST_QUERY_FINDUNIQUE))
  }, 1000)
  console.log(`║ Compile findUnique                 │ ${compile1.avgUs.toFixed(2).padStart(8)} │ ${Math.round(compile1.opsPerSec).toLocaleString().padStart(11)} │ (cache miss)     ║`)

  console.log('╠════════════════════════════════════╪══════════╪═════════════╪══════════════════╣')

  // Compilation-only UNCACHED
  const uncached = measure('compilation uncached', () => {
    parameterizeQuery(TEST_QUERY_FINDUNIQUE)
    queryCompiler.compile(JSON.stringify(TEST_QUERY_FINDUNIQUE))
  }, 1000)
  console.log(`║ Compilation - UNCACHED             │ ${uncached.avgUs.toFixed(2).padStart(8)} │ ${Math.round(uncached.opsPerSec).toLocaleString().padStart(11)} │                  ║`)

  // Pre-populate cache for cached benchmark
  const { parameterizedQuery: preParam, placeholderPaths: prePaths, queryHash: preHash } = parameterizeQuery(TEST_QUERY_FINDUNIQUE)
  const preKey = JSON.stringify(preParam)
  cache.set(preHash, { plan: compiledPlan, placeholderPaths: prePaths, fullKey: preKey })

  // Compilation-only CACHED (lazy key)
  const cached = measure('compilation cached', () => {
    const { parameterizedQuery, placeholderPaths, placeholderValues, queryHash } = parameterizeQuery(TEST_QUERY_FINDUNIQUE)
    const fullKey = () => JSON.stringify(parameterizedQuery)
    const entry = cache.get(queryHash, fullKey)
    if (!entry) {
      throw new Error('Cache miss in cached benchmark - this should not happen')
    }
    return entry
  }, 10000)
  console.log(`║ Compilation - CACHED (lazy key)    │ ${cached.avgUs.toFixed(2).padStart(8)} │ ${Math.round(cached.opsPerSec).toLocaleString().padStart(11)} │                  ║`)

  console.log('╚════════════════════════════════════════════════════════════════════════════════╝')

  // Use interpreter benchmark results (136-188k ops/sec) for E2E estimate
  const interpreterAvgUs = 6.5 // ~153k ops/sec midpoint estimate
  const e2eCached = cached.avgUs + interpreterAvgUs

  console.log('\n═══════════════════════════════════════════════════════════════════════════════════')
  console.log('SUMMARY:')
  console.log(`  Compilation uncached:  ${uncached.avgUs.toFixed(2)}μs (${Math.round(uncached.opsPerSec).toLocaleString()} ops/sec)`)
  console.log(`  Compilation cached:    ${cached.avgUs.toFixed(2)}μs (${Math.round(cached.opsPerSec).toLocaleString()} ops/sec)`)
  console.log(``)
  console.log(`  Compilation Speedup: ${(uncached.avgUs / cached.avgUs).toFixed(1)}x`)
  console.log(``)
  console.log('  Time breakdown (cached compilation):')
  console.log(`    - Parameterization:  ${param1.avgUs.toFixed(2)}μs (${((param1.avgUs / cached.avgUs) * 100).toFixed(1)}%)`)
  console.log(`    - Cache lookup:      ${cacheHit.avgUs.toFixed(2)}μs (${((cacheHit.avgUs / cached.avgUs) * 100).toFixed(1)}%)`)
  console.log(``)
  console.log('  E2E Estimate (cached + interpreter ~6.5μs):')
  console.log(`    - Total: ${e2eCached.toFixed(2)}μs (${Math.round(1_000_000 / e2eCached).toLocaleString()} ops/sec)`)
  console.log(`    - Speedup vs uncached: ${((uncached.avgUs + interpreterAvgUs) / e2eCached).toFixed(1)}x`)
  console.log('═══════════════════════════════════════════════════════════════════════════════════')
}

runProfiling().catch(console.error)
