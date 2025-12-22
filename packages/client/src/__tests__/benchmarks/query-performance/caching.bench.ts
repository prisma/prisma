/**
 * Query Plan Caching Performance Benchmarks
 *
 * Tests the effectiveness of query plan caching by comparing:
 * 1. First query (cache miss - requires compilation)
 * 2. Repeated queries (cache hit - skip compilation)
 * 3. Cache lookup overhead
 * 4. Parameterization overhead
 */
import fs from 'node:fs'
import path from 'node:path'

import { withCodSpeed } from '@codspeed/benchmark.js-plugin'
import { QueryCompiler, QueryCompilerConstructor } from '@prisma/client-common'
import Benchmark from 'benchmark'

import { wasmQueryCompilerLoader } from '../../../runtime/core/engines/client/WasmQueryCompilerLoader'

let QueryCompilerClass: QueryCompilerConstructor
let queryCompiler: QueryCompiler

const BENCHMARK_DATAMODEL = fs.readFileSync(path.join(__dirname, 'schema.prisma'), 'utf-8')

// Test queries with varying complexity
const TEST_QUERIES = {
  findUniqueSimple: {
    modelName: 'User',
    action: 'findUnique',
    query: {
      arguments: { where: { id: 1 } },
      selection: {
        $scalars: true,
      },
    },
  },

  findManyWithFilter: {
    modelName: 'User',
    action: 'findMany',
    query: {
      arguments: {
        where: { isActive: true, role: 'user' },
        orderBy: [{ createdAt: 'desc' }],
        take: 20,
      },
      selection: {
        $scalars: true,
      },
    },
  },

  blogPostPage: {
    modelName: 'Post',
    action: 'findUnique',
    query: {
      arguments: { where: { id: 1 } },
      selection: {
        $scalars: true,
        author: {
          selection: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        category: {
          selection: {
            $scalars: true,
          },
        },
        tags: {
          selection: {
            tag: {
              selection: {
                $scalars: true,
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
            $scalars: true,
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
  },
}

// Queries with different IDs (same shape, different values)
function createQueryWithDifferentId(id: number) {
  return {
    modelName: 'User',
    action: 'findUnique',
    query: {
      arguments: { where: { id } },
      selection: {
        $scalars: true,
      },
    },
  }
}

async function setup(): Promise<void> {
  const runtimeBase = path.join(__dirname, '..', '..', '..', '..', 'runtime')
  const provider = 'sqlite'

  QueryCompilerClass = await wasmQueryCompilerLoader.loadQueryCompiler({
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

  queryCompiler = new QueryCompilerClass({
    provider,
    connectionInfo: {
      supportsRelationJoins: false,
    },
    datamodel: BENCHMARK_DATAMODEL,
  })
}

function syncBench(fn: () => void): Benchmark.Options {
  return { fn }
}

async function runBenchmarks(): Promise<void> {
  await setup()

  const suite = withCodSpeed(new Benchmark.Suite('query-caching'))

  // ============================================
  // Baseline: Uncached Compilation
  // ============================================

  suite.add(
    'compile findUnique (uncached baseline)',
    syncBench(() => {
      queryCompiler.compile(JSON.stringify(TEST_QUERIES.findUniqueSimple))
    }),
  )

  suite.add(
    'compile findMany filtered (uncached baseline)',
    syncBench(() => {
      queryCompiler.compile(JSON.stringify(TEST_QUERIES.findManyWithFilter))
    }),
  )

  suite.add(
    'compile blog post page (uncached baseline)',
    syncBench(() => {
      queryCompiler.compile(JSON.stringify(TEST_QUERIES.blogPostPage))
    }),
  )

  // ============================================
  // Query Shape Variation
  // (Different IDs should hit same cache entry with proper parameterization)
  // ============================================

  let queryCounter = 0
  suite.add(
    'compile findUnique varying IDs',
    syncBench(() => {
      queryCounter++
      const query = createQueryWithDifferentId(queryCounter % 1000)
      queryCompiler.compile(JSON.stringify(query))
    }),
  )

  // ============================================
  // JSON.stringify Overhead
  // (This measures the baseline cost of serializing queries)
  // ============================================

  suite.add(
    'JSON.stringify simple query',
    syncBench(() => {
      JSON.stringify(TEST_QUERIES.findUniqueSimple)
    }),
  )

  suite.add(
    'JSON.stringify complex query',
    syncBench(() => {
      JSON.stringify(TEST_QUERIES.blogPostPage)
    }),
  )

  // ============================================
  // Object Operations Overhead
  // (Baseline for cache key generation alternatives)
  // ============================================

  const simpleQueryStr = JSON.stringify(TEST_QUERIES.findUniqueSimple)
  const complexQueryStr = JSON.stringify(TEST_QUERIES.blogPostPage)

  suite.add(
    'Map get/set simple key',
    syncBench(() => {
      const cache = new Map<string, unknown>()
      cache.set(simpleQueryStr, { plan: {} })
      cache.get(simpleQueryStr)
    }),
  )

  suite.add(
    'Map get/set complex key',
    syncBench(() => {
      const cache = new Map<string, unknown>()
      cache.set(complexQueryStr, { plan: {} })
      cache.get(complexQueryStr)
    }),
  )

  // ============================================
  // Batch Query Compilation
  // ============================================

  const batchQueries = Array.from({ length: 5 }, (_, i) => createQueryWithDifferentId(i + 1))

  suite.add(
    'compile batch of 5 findUnique queries',
    syncBench(() => {
      for (const query of batchQueries) {
        queryCompiler.compile(JSON.stringify(query))
      }
    }),
  )

  await new Promise<void>((resolve) => {
    suite
      .on('cycle', (event: Benchmark.Event) => {
        console.log(String(event.target))
      })
      .on('complete', () => {
        console.log('Query caching benchmarks complete.')
        resolve()
      })
      .on('error', (event: Benchmark.Event) => {
        console.error('Benchmark error:', event.target)
      })
      .run({ async: true })
  })
}

void runBenchmarks()
