/**
 * Query Pipeline Profiling Tool
 *
 * This script measures individual components of the query execution pipeline
 * to identify optimization opportunities.
 */
import fs from 'node:fs'
import path from 'node:path'

import { wasmQueryCompilerLoader } from '../../../runtime/core/engines/client/WasmQueryCompilerLoader'
import { parameterizeQuery } from '../../../runtime/core/engines/client/parameterize'
import { fnv1aHash, generateCacheKey } from '../../../runtime/core/engines/client/hash'
import { QueryPlanCache } from '../../../runtime/core/engines/client/QueryPlanCache'
import type { QueryCompiler, QueryCompilerConstructor, QueryPlanNode } from '@prisma/client-common'

const BENCHMARK_DATAMODEL = fs.readFileSync(path.join(__dirname, 'schema.prisma'), 'utf-8')

const TEST_QUERY = {
  modelName: 'User',
  action: 'findUnique',
  query: {
    arguments: { where: { id: 1 } },
    selection: { $scalars: true },
  },
}

const COMPLEX_QUERY = {
  modelName: 'Post',
  action: 'findUnique',
  query: {
    arguments: { where: { id: 1 } },
    selection: {
      $scalars: true,
      author: {
        selection: { id: true, name: true },
      },
      comments: {
        arguments: { take: 10 },
        selection: {
          $scalars: true,
          author: { selection: { id: true, name: true } },
        },
      },
    },
  },
}

interface ProfileResult {
  operation: string
  iterations: number
  totalMs: number
  avgUs: number
  opsPerSec: number
}

function profile(name: string, iterations: number, fn: () => void): ProfileResult {
  // Warmup
  for (let i = 0; i < Math.min(iterations / 10, 100); i++) {
    fn()
  }

  const start = process.hrtime.bigint()
  for (let i = 0; i < iterations; i++) {
    fn()
  }
  const end = process.hrtime.bigint()

  const totalNs = Number(end - start)
  const totalMs = totalNs / 1_000_000
  const avgNs = totalNs / iterations
  const avgUs = avgNs / 1_000
  const opsPerSec = 1_000_000_000 / avgNs

  return {
    operation: name,
    iterations,
    totalMs,
    avgUs,
    opsPerSec,
  }
}

async function profileAsync(name: string, iterations: number, fn: () => Promise<void>): Promise<ProfileResult> {
  // Warmup
  for (let i = 0; i < Math.min(iterations / 10, 100); i++) {
    await fn()
  }

  const start = process.hrtime.bigint()
  for (let i = 0; i < iterations; i++) {
    await fn()
  }
  const end = process.hrtime.bigint()

  const totalNs = Number(end - start)
  const totalMs = totalNs / 1_000_000
  const avgNs = totalNs / iterations
  const avgUs = avgNs / 1_000
  const opsPerSec = 1_000_000_000 / avgNs

  return {
    operation: name,
    iterations,
    totalMs,
    avgUs,
    opsPerSec,
  }
}

function printResults(results: ProfileResult[]) {
  console.log('\n╔════════════════════════════════════════════════════════════════════════╗')
  console.log('║                     Query Pipeline Profile Results                      ║')
  console.log('╠════════════════════════════════════════════════════════════════════════╣')
  console.log('║ Operation                          │ Avg (μs) │    Ops/sec │  % of E2E ║')
  console.log('╠════════════════════════════════════╪══════════╪════════════╪═══════════╣')

  const e2eResult = results.find((r) => r.operation.includes('E2E'))
  const e2eUs = e2eResult?.avgUs || 1

  for (const r of results) {
    const pct = (r.avgUs / e2eUs) * 100
    const pctStr = pct > 100 ? '-' : `${pct.toFixed(1)}%`
    console.log(
      `║ ${r.operation.padEnd(34)} │ ${r.avgUs.toFixed(2).padStart(8)} │ ${Math.round(r.opsPerSec).toLocaleString().padStart(10)} │ ${pctStr.padStart(9)} ║`,
    )
  }

  console.log('╚════════════════════════════════════════════════════════════════════════╝\n')
}

async function main() {
  console.log('Setting up profiling environment...')

  const runtimeBase = path.join(__dirname, '..', '..', '..', '..', 'runtime')
  const provider = 'sqlite'

  const QueryCompilerClass = await wasmQueryCompilerLoader.loadQueryCompiler({
    activeProvider: provider,
    clientVersion: '0.0.0',
    compilerWasm: {
      getRuntime: () => Promise.resolve(require(path.join(runtimeBase, `query_compiler_bg.${provider}.js`))),
      getQueryCompilerWasmModule: () => {
        const queryCompilerWasmFilePath = path.join(runtimeBase, `query_compiler_bg.${provider}.wasm-base64.js`)
        const wasmBase64: string = require(queryCompilerWasmFilePath).wasm
        return Promise.resolve(new WebAssembly.Module(Buffer.from(wasmBase64, 'base64')))
      },
    },
  })

  const queryCompiler = new QueryCompilerClass({
    provider,
    connectionInfo: { supportsRelationJoins: false },
    datamodel: BENCHMARK_DATAMODEL,
  })

  const cache = new QueryPlanCache()
  const results: ProfileResult[] = []

  // =======================================
  // 1. JSON Serialization
  // =======================================
  results.push(profile('JSON.stringify (simple query)', 100000, () => {
    JSON.stringify(TEST_QUERY)
  }))

  results.push(profile('JSON.stringify (complex query)', 100000, () => {
    JSON.stringify(COMPLEX_QUERY)
  }))

  // =======================================
  // 2. Parameterization
  // =======================================
  results.push(profile('parameterizeQuery (simple)', 100000, () => {
    parameterizeQuery(TEST_QUERY)
  }))

  results.push(profile('parameterizeQuery (complex)', 100000, () => {
    parameterizeQuery(COMPLEX_QUERY)
  }))

  // =======================================
  // 3. Hash Generation
  // =======================================
  const simpleQueryStr = JSON.stringify(TEST_QUERY)
  results.push(profile('fnv1aHash (simple query string)', 100000, () => {
    fnv1aHash(simpleQueryStr)
  }))

  results.push(profile('generateCacheKey (simple)', 100000, () => {
    generateCacheKey(TEST_QUERY.modelName, TEST_QUERY.action, TEST_QUERY.query)
  }))

  // =======================================
  // 4. Cache Operations
  // =======================================
  const { parameterizedQuery, placeholderPaths, queryHash } = parameterizeQuery(TEST_QUERY)
  const cacheKey = JSON.stringify(parameterizedQuery)
  const compiledPlan = queryCompiler.compile(JSON.stringify(TEST_QUERY)) as QueryPlanNode

  cache.set(queryHash, { plan: compiledPlan, placeholderPaths, fullKey: cacheKey })

  results.push(profile('cache.get (hit)', 100000, () => {
    cache.get(queryHash, cacheKey)
  }))

  results.push(profile('cache.get (miss)', 100000, () => {
    cache.get(queryHash + 1, 'nonexistent')
  }))

  // =======================================
  // 5. Query Compilation (baseline)
  // =======================================
  results.push(profile('queryCompiler.compile (simple)', 10000, () => {
    queryCompiler.compile(simpleQueryStr)
  }))

  const complexQueryStr = JSON.stringify(COMPLEX_QUERY)
  results.push(profile('queryCompiler.compile (complex)', 5000, () => {
    queryCompiler.compile(complexQueryStr)
  }))

  // =======================================
  // 6. Full Pipeline Comparison
  // =======================================

  // Uncached path
  results.push(profile('Full Pipeline - UNCACHED', 5000, () => {
    const queryStr = JSON.stringify(TEST_QUERY)
    queryCompiler.compile(queryStr)
  }))

  // Cached path (old approach with eager JSON.stringify)
  results.push(profile('Full Pipeline - CACHED (eager key)', 100000, () => {
    const { parameterizedQuery, queryHash } = parameterizeQuery(TEST_QUERY)
    const cacheKey = JSON.stringify(parameterizedQuery)
    cache.get(queryHash, cacheKey)
  }))

  // Cached path (new approach with lazy key generation)
  results.push(profile('Full Pipeline - CACHED (lazy key)', 100000, () => {
    const { parameterizedQuery, queryHash } = parameterizeQuery(TEST_QUERY)
    cache.get(queryHash, () => JSON.stringify(parameterizedQuery))
  }))

  // Calculate E2E approximation
  const paramResult = results.find((r) => r.operation === 'parameterizeQuery (simple)')!
  const cacheResult = results.find((r) => r.operation === 'cache.get (hit)')!
  const estimatedE2eCached = paramResult.avgUs + cacheResult.avgUs + 3 // +3μs for interpreter estimate

  results.push({
    operation: 'E2E Estimate (cached + interpreter)',
    iterations: 1,
    totalMs: 0,
    avgUs: estimatedE2eCached,
    opsPerSec: 1_000_000 / estimatedE2eCached,
  })

  printResults(results)

  // Print summary
  const uncachedResult = results.find((r) => r.operation === 'Full Pipeline - UNCACHED')!
  const cachedEagerResult = results.find((r) => r.operation === 'Full Pipeline - CACHED (eager key)')!
  const cachedLazyResult = results.find((r) => r.operation === 'Full Pipeline - CACHED (lazy key)')!

  console.log('═══════════════════════════════════════════════════════════════════════════')
  console.log('SUMMARY:')
  console.log(`  Uncached compilation:  ${uncachedResult.avgUs.toFixed(2)}μs (${Math.round(uncachedResult.opsPerSec).toLocaleString()} ops/sec)`)
  console.log(`  Cached (eager key):    ${cachedEagerResult.avgUs.toFixed(2)}μs (${Math.round(cachedEagerResult.opsPerSec).toLocaleString()} ops/sec)`)
  console.log(`  Cached (lazy key):     ${cachedLazyResult.avgUs.toFixed(2)}μs (${Math.round(cachedLazyResult.opsPerSec).toLocaleString()} ops/sec)`)
  console.log('')
  console.log(`  Speedup (uncached → eager):  ${(uncachedResult.avgUs / cachedEagerResult.avgUs).toFixed(1)}x`)
  console.log(`  Speedup (uncached → lazy):   ${(uncachedResult.avgUs / cachedLazyResult.avgUs).toFixed(1)}x`)
  console.log(`  Lazy key improvement:        ${((1 - cachedLazyResult.avgUs / cachedEagerResult.avgUs) * 100).toFixed(1)}%`)
  console.log('═══════════════════════════════════════════════════════════════════════════')
}

main().catch(console.error)
