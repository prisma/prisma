/**
 * Query Compilation Performance Benchmarks
 *
 * Tests the performance of the Wasm query compiler for various query types.
 * Measures compilation time separately from execution time.
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

const QUERIES = {
  findUniqueSimple: JSON.stringify({
    modelName: 'User',
    action: 'findUnique',
    query: {
      arguments: { where: { id: 1 } },
      selection: {
        $scalars: true,
      },
    },
  }),

  findUniqueSelect: JSON.stringify({
    modelName: 'User',
    action: 'findUnique',
    query: {
      arguments: { where: { id: 1 } },
      selection: {
        id: true,
        email: true,
        name: true,
      },
    },
  }),

  findManySimple: JSON.stringify({
    modelName: 'User',
    action: 'findMany',
    query: {
      arguments: { take: 10 },
      selection: {
        $scalars: true,
      },
    },
  }),

  findManyFiltered: JSON.stringify({
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
  }),

  findManyComplexWhere: JSON.stringify({
    modelName: 'Post',
    action: 'findMany',
    query: {
      arguments: {
        where: {
          published: true,
          OR: [{ featured: true }, { viewCount: { gt: 100 } }],
        },
        take: 20,
      },
      selection: {
        $scalars: true,
      },
    },
  }),

  findUniqueWithInclude1to1: JSON.stringify({
    modelName: 'User',
    action: 'findUnique',
    query: {
      arguments: { where: { id: 1 } },
      selection: {
        $scalars: true,
        profile: {
          selection: {
            $scalars: true,
          },
        },
      },
    },
  }),

  findUniqueWithInclude1toN: JSON.stringify({
    modelName: 'User',
    action: 'findUnique',
    query: {
      arguments: { where: { id: 1 } },
      selection: {
        $scalars: true,
        posts: {
          selection: {
            $scalars: true,
          },
        },
      },
    },
  }),

  findManyNestedIncludes: JSON.stringify({
    modelName: 'User',
    action: 'findMany',
    query: {
      arguments: { take: 10 },
      selection: {
        $scalars: true,
        profile: {
          selection: {
            $scalars: true,
          },
        },
        posts: {
          arguments: { take: 5 },
          selection: {
            $scalars: true,
            comments: {
              arguments: { take: 3 },
              selection: {
                $scalars: true,
              },
            },
          },
        },
      },
    },
  }),

  findManyDeepNested: JSON.stringify({
    modelName: 'Post',
    action: 'findMany',
    query: {
      arguments: { take: 10 },
      selection: {
        $scalars: true,
        author: {
          selection: {
            id: true,
            name: true,
            profile: {
              selection: {
                $scalars: true,
              },
            },
          },
        },
        category: {
          selection: {
            $scalars: true,
          },
        },
        comments: {
          arguments: {
            take: 5,
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
        tags: {
          selection: {
            tag: {
              selection: {
                $scalars: true,
              },
            },
          },
        },
      },
    },
  }),

  createSimple: JSON.stringify({
    modelName: 'User',
    action: 'createOne',
    query: {
      arguments: {
        data: {
          email: 'test@example.com',
          username: 'testuser',
          name: 'Test User',
        },
      },
      selection: {
        $scalars: true,
      },
    },
  }),

  createNested: JSON.stringify({
    modelName: 'User',
    action: 'createOne',
    query: {
      arguments: {
        data: {
          email: 'test@example.com',
          username: 'testuser',
          name: 'Test User',
          profile: {
            create: {
              firstName: 'Test',
              lastName: 'User',
            },
          },
        },
      },
      selection: {
        $scalars: true,
        profile: {
          selection: {
            $scalars: true,
          },
        },
      },
    },
  }),

  updateSimple: JSON.stringify({
    modelName: 'User',
    action: 'updateOne',
    query: {
      arguments: {
        where: { id: 1 },
        data: { name: 'Updated Name' },
      },
      selection: {
        $scalars: true,
      },
    },
  }),

  updateMany: JSON.stringify({
    modelName: 'Post',
    action: 'updateMany',
    query: {
      arguments: {
        where: { published: false },
        data: { viewCount: { increment: 1 } },
      },
      selection: {
        count: true,
      },
    },
  }),

  upsert: JSON.stringify({
    modelName: 'User',
    action: 'upsertOne',
    query: {
      arguments: {
        where: { email: 'test@example.com' },
        create: {
          email: 'test@example.com',
          username: 'testuser',
          name: 'Test User',
        },
        update: {
          name: 'Updated User',
        },
      },
      selection: {
        $scalars: true,
      },
    },
  }),

  deleteSimple: JSON.stringify({
    modelName: 'User',
    action: 'deleteOne',
    query: {
      arguments: {
        where: { id: 1 },
      },
      selection: {
        $scalars: true,
      },
    },
  }),

  count: JSON.stringify({
    modelName: 'User',
    action: 'aggregate',
    query: {
      arguments: {},
      selection: {
        _count: true,
      },
    },
  }),

  countFiltered: JSON.stringify({
    modelName: 'Post',
    action: 'aggregate',
    query: {
      arguments: {
        where: { published: true },
      },
      selection: {
        _count: true,
      },
    },
  }),

  aggregate: JSON.stringify({
    modelName: 'Product',
    action: 'aggregate',
    query: {
      arguments: {},
      selection: {
        _count: true,
        _sum: {
          selection: { price: true },
        },
        _avg: {
          selection: { price: true },
        },
        _min: {
          selection: { price: true },
        },
        _max: {
          selection: { price: true },
        },
      },
    },
  }),

  groupBy: JSON.stringify({
    modelName: 'User',
    action: 'groupBy',
    query: {
      arguments: {
        by: ['role'],
      },
      selection: {
        _count: {
          selection: { _all: true },
        },
      },
    },
  }),

  blogPostPage: JSON.stringify({
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
  }),

  blogListingPage: JSON.stringify({
    modelName: 'Post',
    action: 'findMany',
    query: {
      arguments: {
        where: { published: true },
        take: 12,
        orderBy: [{ createdAt: 'desc' }],
      },
      selection: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        createdAt: true,
        author: {
          selection: {
            name: true,
            avatar: true,
          },
        },
        category: {
          selection: {
            name: true,
            slug: true,
          },
        },
        _count: {
          selection: {
            comments: true,
            likes: true,
          },
        },
      },
    },
  }),

  userProfilePage: JSON.stringify({
    modelName: 'User',
    action: 'findUnique',
    query: {
      arguments: { where: { id: 1 } },
      selection: {
        $scalars: true,
        profile: {
          selection: {
            $scalars: true,
          },
        },
        posts: {
          arguments: {
            where: { published: true },
            take: 5,
            orderBy: [{ createdAt: 'desc' }],
          },
          selection: {
            id: true,
            title: true,
            slug: true,
            createdAt: true,
          },
        },
        _count: {
          selection: {
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
    },
  }),

  orderHistory: JSON.stringify({
    modelName: 'Order',
    action: 'findMany',
    query: {
      arguments: {
        where: { userId: 1 },
        orderBy: [{ createdAt: 'desc' }],
        take: 10,
      },
      selection: {
        $scalars: true,
        items: {
          selection: {
            $scalars: true,
            product: {
              selection: {
                name: true,
                slug: true,
                price: true,
              },
            },
          },
        },
      },
    },
  }),
}

async function setup(): Promise<void> {
  const runtimeBase = path.join(__dirname, '..', '..', '..', '..', 'runtime')
  const provider = 'sqlite'

  QueryCompilerClass = await wasmQueryCompilerLoader.loadQueryCompiler({
    activeProvider: provider,
    clientVersion: '0.0.0',
    compilerWasm: {
      getRuntime: () => {
        let runtimePath: string
        if (process.env.LOCAL_QC_BUILD_DIRECTORY) {
          runtimePath = path.join(process.env.LOCAL_QC_BUILD_DIRECTORY, provider, 'query_compiler_bg.js')
        } else {
          runtimePath = path.join(runtimeBase, `query_compiler_bg.${provider}.js`)
        }
        return Promise.resolve(require(runtimePath))
      },
      getQueryCompilerWasmModule: async () => {
        let moduleBytes: BufferSource
        if (process.env.LOCAL_QC_BUILD_DIRECTORY) {
          const wasmPath = path.join(process.env.LOCAL_QC_BUILD_DIRECTORY, provider, 'query_compiler_bg.wasm')
          moduleBytes = await fs.promises.readFile(wasmPath)
        } else {
          const queryCompilerWasmFilePath = path.join(runtimeBase, `query_compiler_bg.${provider}.wasm-base64.js`)
          const wasmBase64: string = require(queryCompilerWasmFilePath).wasm
          moduleBytes = Buffer.from(wasmBase64, 'base64')
        }
        return new WebAssembly.Module(moduleBytes)
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

  const suite = withCodSpeed(new Benchmark.Suite('query-compilation'))

  // ============================================
  // Simple Read Queries
  // ============================================

  suite.add(
    'compile findUnique simple',
    syncBench(() => {
      queryCompiler.compile(QUERIES.findUniqueSimple)
    }),
  )

  suite.add(
    'compile findUnique with select',
    syncBench(() => {
      queryCompiler.compile(QUERIES.findUniqueSelect)
    }),
  )

  suite.add(
    'compile findMany simple',
    syncBench(() => {
      queryCompiler.compile(QUERIES.findManySimple)
    }),
  )

  suite.add(
    'compile findMany filtered',
    syncBench(() => {
      queryCompiler.compile(QUERIES.findManyFiltered)
    }),
  )

  suite.add(
    'compile findMany complex where',
    syncBench(() => {
      queryCompiler.compile(QUERIES.findManyComplexWhere)
    }),
  )

  // ============================================
  // Queries with Includes
  // ============================================

  suite.add(
    'compile findUnique with 1:1 include',
    syncBench(() => {
      queryCompiler.compile(QUERIES.findUniqueWithInclude1to1)
    }),
  )

  suite.add(
    'compile findUnique with 1:N include',
    syncBench(() => {
      queryCompiler.compile(QUERIES.findUniqueWithInclude1toN)
    }),
  )

  suite.add(
    'compile findMany nested includes',
    syncBench(() => {
      queryCompiler.compile(QUERIES.findManyNestedIncludes)
    }),
  )

  suite.add(
    'compile findMany deep nested',
    syncBench(() => {
      queryCompiler.compile(QUERIES.findManyDeepNested)
    }),
  )

  // ============================================
  // Write Queries
  // ============================================

  suite.add(
    'compile create simple',
    syncBench(() => {
      queryCompiler.compile(QUERIES.createSimple)
    }),
  )

  suite.add(
    'compile create nested',
    syncBench(() => {
      queryCompiler.compile(QUERIES.createNested)
    }),
  )

  suite.add(
    'compile update simple',
    syncBench(() => {
      queryCompiler.compile(QUERIES.updateSimple)
    }),
  )

  suite.add(
    'compile updateMany',
    syncBench(() => {
      queryCompiler.compile(QUERIES.updateMany)
    }),
  )

  suite.add(
    'compile upsert',
    syncBench(() => {
      queryCompiler.compile(QUERIES.upsert)
    }),
  )

  suite.add(
    'compile delete simple',
    syncBench(() => {
      queryCompiler.compile(QUERIES.deleteSimple)
    }),
  )

  // ============================================
  // Aggregation Queries
  // ============================================

  suite.add(
    'compile count',
    syncBench(() => {
      queryCompiler.compile(QUERIES.count)
    }),
  )

  suite.add(
    'compile count filtered',
    syncBench(() => {
      queryCompiler.compile(QUERIES.countFiltered)
    }),
  )

  suite.add(
    'compile aggregate',
    syncBench(() => {
      queryCompiler.compile(QUERIES.aggregate)
    }),
  )

  suite.add(
    'compile groupBy',
    syncBench(() => {
      queryCompiler.compile(QUERIES.groupBy)
    }),
  )

  // ============================================
  // Realistic Page Queries
  // ============================================

  suite.add(
    'compile blog post page',
    syncBench(() => {
      queryCompiler.compile(QUERIES.blogPostPage)
    }),
  )

  suite.add(
    'compile blog listing page',
    syncBench(() => {
      queryCompiler.compile(QUERIES.blogListingPage)
    }),
  )

  suite.add(
    'compile user profile page',
    syncBench(() => {
      queryCompiler.compile(QUERIES.userProfilePage)
    }),
  )

  suite.add(
    'compile order history',
    syncBench(() => {
      queryCompiler.compile(QUERIES.orderHistory)
    }),
  )

  // ============================================
  // Query Compiler Instantiation
  // ============================================

  suite.add(
    'instantiate query compiler',
    syncBench(() => {
      queryCompiler = new QueryCompilerClass({
        provider: 'sqlite',
        connectionInfo: {
          supportsRelationJoins: false,
        },
        datamodel: BENCHMARK_DATAMODEL,
      })
    }),
  )

  await new Promise<void>((resolve) => {
    void suite
      .on('cycle', (event: Benchmark.Event) => {
        console.log(String(event.target))
      })
      .on('complete', () => {
        resolve()
      })
      .on('error', (event: Benchmark.Event) => {
        console.error('Benchmark error:', event.target)
      })
      .run({ async: true })
  })
}

void runBenchmarks()
