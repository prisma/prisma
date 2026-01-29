import fs from 'node:fs'
import path from 'node:path'

import { withCodSpeed } from '@codspeed/benchmark.js-plugin'
import { dmmfToRuntimeDataModel, type QueryCompiler, type QueryCompilerConstructor } from '@prisma/client-common'
import { getDMMF } from '@prisma/client-generator-js'
import type { JsonQuery } from '@prisma/json-protocol'
import { buildParamGraph } from '@prisma/param-graph-builder'
import Benchmark from 'benchmark'

import {
  createParamGraphView,
  ParamGraphView,
} from '../../../runtime/core/engines/client/parameterization/param-graph-view'
import { parameterizeQuery } from '../../../runtime/core/engines/client/parameterization/parameterize'
import { loadQueryCompiler } from './qc-loader'

let QueryCompiler: QueryCompilerConstructor
let queryCompiler: QueryCompiler

const BENCHMARK_DATAMODEL = fs.readFileSync(path.join(__dirname, 'schema.prisma'), 'utf-8')

let paramGraphView: ParamGraphView

type Param = { $type: 'Param'; value: string }
type Parameterizable<T> = T | Param

function createFindUniqueQuery(id: Parameterizable<number>): JsonQuery {
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

function createFindManyQuery(): JsonQuery {
  return {
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
  }
}

function createBlogPostPageQuery(id: Parameterizable<number>): JsonQuery {
  return {
    modelName: 'Post',
    action: 'findUnique',
    query: {
      arguments: { where: { id } },
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
  }
}

async function setup(): Promise<void> {
  const provider = 'sqlite'

  QueryCompiler = await loadQueryCompiler(provider)

  queryCompiler = new QueryCompiler({
    provider,
    connectionInfo: {
      supportsRelationJoins: false,
    },
    datamodel: BENCHMARK_DATAMODEL,
  })

  const dmmf = await getDMMF({ datamodel: BENCHMARK_DATAMODEL })
  const paramGraph = buildParamGraph(dmmf)
  const runtimeDataModel = dmmfToRuntimeDataModel(dmmf.datamodel)
  paramGraphView = createParamGraphView(paramGraph, runtimeDataModel)
}

function syncBench(fn: () => void): Benchmark.Options {
  return { fn }
}

async function runBenchmarks(): Promise<void> {
  await setup()

  const suite = withCodSpeed(new Benchmark.Suite('query-caching'))

  suite.add(
    'compile findUnique (uncached baseline)',
    syncBench(() => {
      queryCompiler.compile(JSON.stringify(createFindUniqueQuery(1)))
    }),
  )

  suite.add(
    'compile findMany filtered (uncached baseline)',
    syncBench(() => {
      queryCompiler.compile(JSON.stringify(createFindManyQuery()))
    }),
  )

  suite.add(
    'compile blog post page (uncached baseline)',
    syncBench(() => {
      queryCompiler.compile(JSON.stringify(createBlogPostPageQuery(1)))
    }),
  )

  suite.add(
    'parameterize findUnique',
    syncBench(() => {
      parameterizeQuery(createFindUniqueQuery(1), paramGraphView)
    }),
  )

  suite.add(
    'parameterize findMany',
    syncBench(() => {
      parameterizeQuery(createFindManyQuery(), paramGraphView)
    }),
  )

  suite.add(
    'parameterize blog post page query',
    syncBench(() => {
      parameterizeQuery(createBlogPostPageQuery(1), paramGraphView)
    }),
  )

  await new Promise<void>((resolve) => {
    void suite
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
