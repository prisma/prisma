import fs from 'node:fs'
import path from 'node:path'

import { withCodSpeed } from '@codspeed/benchmark.js-plugin'
import { dmmfToRuntimeDataModel, type QueryCompiler, type QueryCompilerConstructor } from '@prisma/client-common'
import { parameterizeQuery } from '@prisma/client-engine-runtime'
import { getDMMF } from '@prisma/client-generator-js'
import type { JsonQuery } from '@prisma/json-protocol'
import { ParamGraph } from '@prisma/param-graph'
import { buildParamGraph } from '@prisma/param-graph-builder'
import Benchmark from 'benchmark'

import { loadQueryCompiler } from './qc-loader'

let QueryCompilerClass: QueryCompilerConstructor
let queryCompiler: QueryCompiler

const BENCHMARK_DATAMODEL = fs.readFileSync(path.join(__dirname, 'schema.prisma'), 'utf-8')

let paramGraph: ParamGraph

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

function createFindManyInFilterQuery(ids: Parameterizable<number>[]): JsonQuery {
  return {
    modelName: 'User',
    action: 'findMany',
    query: {
      arguments: {
        where: { id: { in: ids } },
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

  QueryCompilerClass = await loadQueryCompiler(provider)

  queryCompiler = new QueryCompilerClass({
    provider,
    connectionInfo: {
      supportsRelationJoins: false,
    },
    datamodel: BENCHMARK_DATAMODEL,
  })

  const dmmf = await getDMMF({ datamodel: BENCHMARK_DATAMODEL })
  const paramGraphData = buildParamGraph(dmmf)
  const runtimeDataModel = dmmfToRuntimeDataModel(dmmf.datamodel)

  paramGraph = ParamGraph.fromData(paramGraphData, (enumName) => {
    const enumDef = runtimeDataModel.enums[enumName]
    const mapping: Record<string, string> = {}
    for (const value of enumDef?.values ?? []) {
      mapping[value.name] = value.dbName ?? value.name
    }
    return mapping
  })
}

function syncBench(fn: () => unknown): Benchmark.Options {
  return { fn }
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

function createCacheHitKey(query: JsonQuery): string {
  const { parameterizedQuery } = parameterizeQuery(query, paramGraph)
  const queryPart = JSON.stringify(parameterizedQuery.query)
  return getSingleQueryCacheKey(parameterizedQuery, queryPart)
}

async function runBenchmarks(): Promise<void> {
  await setup()

  const suite = withCodSpeed(new Benchmark.Suite('query-caching'))
  const findUniqueQuery = createFindUniqueQuery(1)
  const findManyQuery = createFindManyQuery()
  const findManyInFilterQuery = createFindManyInFilterQuery([1, 2, 3, 4, 5])
  const blogPostPageQuery = createBlogPostPageQuery(1)

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
      parameterizeQuery(findUniqueQuery, paramGraph)
    }),
  )

  suite.add(
    'parameterize findMany',
    syncBench(() => {
      parameterizeQuery(findManyQuery, paramGraph)
    }),
  )

  suite.add(
    'parameterize findMany in filter',
    syncBench(() => {
      parameterizeQuery(findManyInFilterQuery, paramGraph)
    }),
  )

  suite.add(
    'parameterize blog post page query',
    syncBench(() => {
      parameterizeQuery(blogPostPageQuery, paramGraph)
    }),
  )

  suite.add(
    'cache hit key findUnique',
    syncBench(() => {
      return createCacheHitKey(findUniqueQuery)
    }),
  )

  suite.add(
    'cache hit key findMany',
    syncBench(() => {
      return createCacheHitKey(findManyQuery)
    }),
  )

  suite.add(
    'cache hit key findMany in filter',
    syncBench(() => {
      return createCacheHitKey(findManyInFilterQuery)
    }),
  )

  suite.add(
    'cache hit key blog post page query',
    syncBench(() => {
      return createCacheHitKey(blogPostPageQuery)
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
