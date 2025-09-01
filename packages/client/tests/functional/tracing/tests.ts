import { faker } from '@faker-js/faker'
import { Attributes, context, SpanKind, trace } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { Resource } from '@opentelemetry/resources'
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  ReadableSpan,
  SimpleSpanProcessor,
  SpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { PrismaInstrumentation } from '@prisma/instrumentation'
import { ClientEngineType } from '@prisma/internals'

import { AdapterProviders, Providers, RelationModes } from '../_utils/providers'
import { waitFor } from '../_utils/tests/waitFor'
import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

type Tree = {
  name: string
  kind?: string | undefined
  attributes?: Attributes
  children?: Tree[]
}

function buildTree(rootSpan: ReadableSpan, spans: ReadableSpan[]): Tree {
  const childrenSpans = spans
    .sort((a, b) => {
      const normalizeNameForComparison = (name: string) => {
        // Replace client engine specific spans with their classic names as sort keys
        // to ensure stable order regardless of the engine type.
        if (
          [
            'prisma:client:db_query',
            'prisma:client:start_transaction',
            'prisma:client:commit_transaction',
            'prisma:client:rollback_transaction',
          ].includes(name)
        ) {
          return 'prisma:engine:' + name.slice('prisma:client:'.length)
        }
        return name
      }
      // Ensures fixed order of children spans regardless of the
      // actual timings. Why use name instead of start time? Sometimes
      // things happen in parallel/different order and startTime does not
      // provide stable ordering guarantee.
      return normalizeNameForComparison(a.name).localeCompare(normalizeNameForComparison(b.name))
    })
    .filter((span) => span.parentSpanId === rootSpan.spanContext().spanId)

  const tree: Tree = {
    name: rootSpan.name,
  }

  if (childrenSpans.length > 0) {
    tree.children = childrenSpans.map((span) => buildTree(span, spans))
  }

  if (Object.keys(rootSpan.attributes).length > 0) {
    tree.attributes = rootSpan.attributes
  }

  if (rootSpan.kind !== SpanKind.INTERNAL) {
    tree.kind = SpanKind[rootSpan.kind]
  }

  return tree
}

declare let prisma: PrismaClient
declare const newPrismaClient: NewPrismaClient<PrismaClient, typeof PrismaClient>

let inMemorySpanExporter: InMemorySpanExporter
let processor: SpanProcessor

beforeAll(() => {
  const contextManager = new AsyncLocalStorageContextManager().enable()
  context.setGlobalContextManager(contextManager)

  inMemorySpanExporter = new InMemorySpanExporter()

  const basicTracerProvider = new BasicTracerProvider({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: 'test-name',
      [ATTR_SERVICE_VERSION]: '1.0.0',
    }),
  })

  processor = new SimpleSpanProcessor(inMemorySpanExporter)
  basicTracerProvider.addSpanProcessor(processor)
  basicTracerProvider.register()

  registerInstrumentations({
    instrumentations: [new PrismaInstrumentation()],
  })
})

afterAll(() => {
  context.disable()
})

testMatrix.setupTestSuite(
  (
    { provider, driverAdapter, relationMode, engineType, clientRuntime, clientEngineExecutor },
    _suiteMeta,
    clientMeta,
  ) => {
    const isMongoDb = provider === Providers.MONGODB
    const isMySql = provider === Providers.MYSQL
    const isSqlServer = provider === Providers.SQLSERVER
    const usesJsDrivers = driverAdapter !== undefined || clientEngineExecutor === 'remote'

    const usesSyntheticTxQueries =
      (driverAdapter !== undefined && ['js_d1', 'js_libsql', 'js_planetscale', 'js_mssql'].includes(driverAdapter)) ||
      (clientEngineExecutor === 'remote' && provider === Providers.SQLSERVER)

    beforeEach(async () => {
      await prisma.$connect()
      inMemorySpanExporter.reset()
    })

    async function waitForSpanTree(expectedTree: Tree | Tree[]): Promise<void> {
      await waitFor(async () => {
        await processor.forceFlush()
        const spans = inMemorySpanExporter.getFinishedSpans()
        const rootSpans = spans.filter((span) => !span.parentSpanId)
        const trees = rootSpans.map((rootSpan) => buildTree(rootSpan, spans))

        if (Array.isArray(expectedTree)) {
          expect(trees).toEqual(expectedTree)
        } else {
          expect(trees[0]).toEqual(expectedTree)
        }
      })
    }

    enum AdapterQueryChildSpans {
      ArgsAndResult,
      ArgsOnly,
      None,
    }

    function dbQuery(statement: string, driverAdapterChildSpans = AdapterQueryChildSpans.ArgsAndResult): Tree {
      const span = {
        name: 'prisma:engine:db_query',
        kind: 'CLIENT',
        attributes: {
          'db.query.text': statement,
        },
      }

      if (engineType === ClientEngineType.Client) {
        span.name = 'prisma:client:db_query'
        // Client engine implements a newer version of OTel Semantic Conventions
        span.attributes['db.system.name'] = dbSystemExpectation()
      } else {
        span.attributes['db.system'] = dbSystemExpectation()
      }

      if (provider === Providers.MONGODB) {
        span.attributes['db.operation.name'] = expect.toBeString()
      }

      // extra children spans for driver adapters, except some queries (BEGIN/COMMIT with `usePhantomQuery: true`)
      if (
        clientMeta.driverAdapter &&
        driverAdapterChildSpans !== AdapterQueryChildSpans.None &&
        engineType !== ClientEngineType.Client
      ) {
        const children = [] as Tree[]

        children.push({
          name: 'prisma:engine:js:query:args',
          kind: 'CLIENT',
          attributes: {
            'prisma.db_query.params.count': expect.toBeNumber(),
          },
        })

        // result span only exists for returning queries
        if (driverAdapterChildSpans !== AdapterQueryChildSpans.ArgsOnly) {
          children.push({
            name: 'prisma:engine:js:query:result',
            kind: 'CLIENT',
            attributes: {
              'db.response.returned_rows': expect.toBeNumber(),
            },
          })
        }

        children.push({
          name: 'prisma:engine:js:query:sql',
          kind: 'CLIENT',
          attributes: {
            'db.query.text': statement,
            'db.system': dbSystemExpectation(),
          },
        })

        span['children'] = children
      }

      return span
    }

    function txSetIsolationLevel() {
      if (usesSyntheticTxQueries) {
        return dbQuery('-- Implicit "SET TRANSACTION" query via underlying driver', AdapterQueryChildSpans.None)
      } else {
        return dbQuery(expect.stringContaining('SET TRANSACTION'), AdapterQueryChildSpans.ArgsOnly)
      }
    }

    function txBegin() {
      if (usesSyntheticTxQueries) {
        return dbQuery('-- Implicit "BEGIN" query via underlying driver', AdapterQueryChildSpans.None)
      } else {
        return dbQuery(expect.stringContaining('BEGIN'), AdapterQueryChildSpans.ArgsOnly)
      }
    }

    function txCommit() {
      if (usesSyntheticTxQueries) {
        return dbQuery('-- Implicit "COMMIT" query via underlying driver', AdapterQueryChildSpans.None)
      } else {
        return dbQuery('COMMIT', AdapterQueryChildSpans.ArgsOnly)
      }
    }

    function txRollback() {
      if (usesSyntheticTxQueries) {
        return dbQuery('-- Implicit "ROLLBACK" query via underlying driver', AdapterQueryChildSpans.None)
      } else {
        return dbQuery('ROLLBACK', AdapterQueryChildSpans.ArgsOnly)
      }
    }

    function operation(model: string | undefined, method: string, children: Tree[]) {
      const attributes: Attributes = {
        method,
        name: model ? `${model}.${method}` : method,
      }

      if (model) {
        attributes.model = model
      }
      return {
        name: 'prisma:client:operation',
        attributes,
        children,
      }
    }

    function engine(children: Tree[]) {
      if (engineType === ClientEngineType.Client) {
        return children
      }
      return [
        {
          name: 'prisma:engine:query',
          children,
        },
      ]
    }

    function clientCompile(action: string, model?: string) {
      return clientCompileBatch([action], model ? [model] : [])
    }

    function clientCompileBatch(actions: string[], models: string[]) {
      if (engineType !== ClientEngineType.Client) {
        return []
      }

      return [
        {
          name: 'prisma:client:compile',
          attributes: { actions, models },
        },
      ]
    }

    function clientSerialize() {
      return { name: 'prisma:client:serialize' }
    }

    function engineSerializeQueryResult() {
      if (engineType === ClientEngineType.Client) {
        return []
      }
      return [{ name: 'prisma:engine:serialize' }]
    }

    function engineSerializeFinalResponse() {
      if (clientMeta.dataProxy || engineType === ClientEngineType.Binary || engineType === ClientEngineType.Client) {
        return []
      }
      return [{ name: 'prisma:engine:response_json_serialization' }]
    }

    function engineSerialize() {
      return [...engineSerializeFinalResponse(), ...engineSerializeQueryResult()]
    }

    function dbSystemExpectation() {
      return expect.toSatisfy((dbSystem) => {
        if (provider === Providers.SQLSERVER) {
          return dbSystem === 'mssql'
        }
        if (driverAdapter === 'js_pg_cockroachdb' && engineType !== ClientEngineType.Client) {
          return dbSystem === 'postgresql'
        }
        return dbSystem === provider
      })
    }

    function engineConnection() {
      if (engineType === ClientEngineType.Client) {
        return []
      }

      return [
        {
          name: 'prisma:engine:connection',
          attributes: {
            'db.system': dbSystemExpectation(),
          },
        },
      ]
    }

    function engineConnect() {
      if (engineType === ClientEngineType.Client) {
        return undefined
      }

      const connectSpan = { name: 'prisma:engine:connect', children: engineConnection() }

      if (engineType === 'binary') {
        return [{ name: 'prisma:client:start_engine', children: [connectSpan] }]
      }

      return [connectSpan]
    }

    function detectPlatform() {
      if (
        clientRuntime === 'wasm-engine-edge' ||
        clientRuntime === 'wasm-compiler-edge' ||
        engineType === ClientEngineType.Client
      ) {
        return []
      }
      return [{ name: 'prisma:client:detect_platform' }]
    }

    function loadEngine() {
      if (engineType === ClientEngineType.Library) {
        return [{ name: 'prisma:client:load_engine' }]
      }
      return []
    }

    function findManyDbQuery() {
      const statement = isMongoDb ? 'db.User.aggregate' : 'SELECT'

      return dbQuery(expect.stringContaining(statement))
    }

    function createDbQueries(tx = true) {
      if (isMongoDb) {
        return [
          dbQuery(expect.stringContaining('db.User.insertOne')),
          dbQuery(expect.stringContaining('db.User.aggregate')),
        ]
      }

      if (['postgresql', 'cockroachdb', 'sqlite'].includes(provider)) {
        return [dbQuery(expect.stringContaining('INSERT'))]
      }

      const dbQueries: Tree[] = []
      if (tx) {
        if (isSqlServer && !usesJsDrivers) {
          dbQueries.push(txSetIsolationLevel())
        }
        if (!usesJsDrivers) {
          // Driver adapters do not issue BEGIN through the query engine.
          dbQueries.push(txBegin())
        }
        if (engineType === ClientEngineType.Client) {
          // The order looks weird (first commit, then start) because spans
          // are sorted by span name.
          dbQueries.push(itxOperation('commit'))
        }
      }

      dbQueries.push(dbQuery(expect.stringContaining('INSERT')), dbQuery(expect.stringContaining('SELECT')))

      if (tx) {
        if (engineType === ClientEngineType.Client) {
          dbQueries.push(itxOperation('start'))
        } else {
          dbQueries.push(txCommit())
        }
      }
      return dbQueries
    }

    function itxOperation(operation: 'start' | 'commit' | 'rollback'): Tree {
      const prefix = engineType === ClientEngineType.Client ? 'prisma:client:' : 'prisma:engine:'
      const name = `${prefix}${operation}_transaction`

      let children: Tree[] | undefined

      if (operation === 'start') {
        children = isMongoDb
          ? engineConnection()
          : isSqlServer && !usesJsDrivers
            ? [...engineConnection(), txSetIsolationLevel(), txBegin()]
            : !usesJsDrivers
              ? [...engineConnection(), txBegin()]
              : engineType === ClientEngineType.Client
                ? undefined
                : engineConnection()
      } else if (operation === 'commit') {
        children = isMongoDb ? undefined : [txCommit()]
      } else if (operation === 'rollback') {
        children = isMongoDb ? undefined : [txRollback()]
      }

      return {
        name,
        children,
      }
    }

    describe('tracing on crud methods', () => {
      let sharedEmail = faker.internet.email()

      test('create', async () => {
        await prisma.user.create({
          data: {
            email: sharedEmail,
          },
        })

        await waitForSpanTree(
          operation('User', 'create', [
            ...clientCompile('createOne', 'User'),
            clientSerialize(),
            ...engine([...engineConnection(), ...createDbQueries(), ...engineSerialize()]),
          ]),
        )
      })

      test('read', async () => {
        await prisma.user.findMany({
          where: {
            email: sharedEmail,
          },
        })

        await waitForSpanTree(
          operation('User', 'findMany', [
            ...clientCompile('findMany', 'User'),
            clientSerialize(),
            ...engine([...engineConnection(), findManyDbQuery(), ...engineSerialize()]),
          ]),
        )
      })

      test('update', async () => {
        const newEmail = faker.internet.email()

        await prisma.user.update({
          data: {
            email: newEmail,
          },
          where: {
            email: sharedEmail,
          },
        })

        sharedEmail = newEmail

        let expectedDbQueries: Tree[]

        if (isMongoDb) {
          expectedDbQueries = [
            dbQuery(expect.stringContaining('db.User.aggregate')),
            dbQuery(expect.stringContaining('db.User.updateMany')),
            dbQuery(expect.stringContaining('db.User.aggregate')),
          ]
        } else if (['postgresql', 'cockroachdb', 'sqlite'].includes(provider)) {
          expectedDbQueries = [dbQuery(expect.stringContaining('UPDATE'))]
        } else {
          expectedDbQueries = [
            dbQuery(expect.stringContaining('SELECT')),
            dbQuery(expect.stringContaining('UPDATE'), AdapterQueryChildSpans.ArgsOnly),
            dbQuery(expect.stringContaining('SELECT')),
          ]
          if (!usesJsDrivers) {
            // Driver adapters do not issue BEGIN through the query engine.
            expectedDbQueries.unshift(txBegin())
          }
          if (isSqlServer && !usesJsDrivers) {
            expectedDbQueries.unshift(txSetIsolationLevel())
          }
          if (engineType === ClientEngineType.Client) {
            expectedDbQueries.push(itxOperation('start'))
            expectedDbQueries.unshift(itxOperation('commit'))
          } else {
            expectedDbQueries.push(txCommit())
          }
        }

        await waitForSpanTree(
          operation('User', 'update', [
            ...clientCompile('updateOne', 'User'),
            clientSerialize(),
            ...engine([...engineConnection(), ...expectedDbQueries, ...engineSerialize()]),
          ]),
        )
      })

      test('delete', async () => {
        await prisma.user.delete({
          where: {
            email: sharedEmail,
          },
        })

        let expectedDbQueries: Tree[]

        if (isMongoDb) {
          expectedDbQueries = [dbQuery(expect.stringContaining('db.User.findAndModify'))]
        } else if (isMySql || isSqlServer) {
          expectedDbQueries = [
            dbQuery(expect.stringContaining('SELECT')),
            dbQuery(expect.stringContaining('DELETE'), AdapterQueryChildSpans.ArgsOnly),
          ]
          if (!usesJsDrivers) {
            // Driver adapters do not issue BEGIN through the query engine.
            expectedDbQueries.unshift(txBegin())
          }
          if (isSqlServer && !usesJsDrivers) {
            expectedDbQueries.unshift(txSetIsolationLevel())
          }
          if (engineType === ClientEngineType.Client) {
            expectedDbQueries.push(itxOperation('start'))
            expectedDbQueries.unshift(itxOperation('commit'))
          } else {
            expectedDbQueries.push(txCommit())
          }
        } else {
          expectedDbQueries = [dbQuery(expect.stringContaining('DELETE'))]
        }
        await waitForSpanTree(
          operation('User', 'delete', [
            ...clientCompile('deleteOne', 'User'),
            clientSerialize(),
            ...engine([...engineConnection(), ...expectedDbQueries, ...engineSerialize()]),
          ]),
        )
      })

      test('deleteMany()', async () => {
        // Needed to see `deleteMany` for MongoDB
        // for context https://github.com/prisma/prisma-engines/blob/a437f71ab038893c0001b09743862e841bedca01/query-engine/connectors/mongodb-query-connector/src/root_queries/write.rs#L259-L261
        await prisma.user.create({
          data: {
            email: sharedEmail,
          },
        })
        inMemorySpanExporter.reset()

        await prisma.user.deleteMany()

        let expectedDbQueries: Tree[]

        if (isMongoDb) {
          expectedDbQueries = [
            dbQuery(expect.stringContaining('db.User.aggregate')),
            dbQuery(expect.stringContaining('db.User.deleteMany')),
          ]
        } else if (relationMode === RelationModes.PRISMA) {
          expectedDbQueries = [
            dbQuery(expect.stringContaining('SELECT')),
            dbQuery(expect.stringContaining('DELETE'), AdapterQueryChildSpans.ArgsOnly),
          ]
          if (!usesJsDrivers) {
            // Driver adapters do not issue BEGIN through the query engine.
            expectedDbQueries.unshift(txBegin())
          }
          if (isSqlServer && !usesJsDrivers) {
            expectedDbQueries.unshift(txSetIsolationLevel())
          }
          if (engineType === ClientEngineType.Client) {
            expectedDbQueries.push(itxOperation('start'))
            expectedDbQueries.unshift(itxOperation('commit'))
          } else {
            expectedDbQueries.push(txCommit())
          }
        } else {
          expectedDbQueries = [dbQuery(expect.stringContaining('DELETE'), AdapterQueryChildSpans.ArgsOnly)]
        }

        await waitForSpanTree(
          operation('User', 'deleteMany', [
            ...clientCompile('deleteMany', 'User'),
            clientSerialize(),
            ...engine([...engineConnection(), ...expectedDbQueries, ...engineSerialize()]),
          ]),
        )
      })

      test('count', async () => {
        await prisma.user.count({
          where: {
            email: sharedEmail,
          },
        })

        await waitForSpanTree(
          operation('User', 'count', [
            ...clientCompile('aggregate', 'User'),
            clientSerialize(),
            ...engine([
              ...engineConnection(),
              isMongoDb
                ? dbQuery(expect.stringContaining('db.User.aggregate'))
                : dbQuery(expect.stringContaining('SELECT COUNT')),
              ...engineSerialize(),
            ]),
          ]),
        )
      })

      test('aggregate', async () => {
        await prisma.user.aggregate({
          where: {
            email: sharedEmail,
          },
          _max: {
            id: true,
          },
        })

        await waitForSpanTree(
          operation('User', 'aggregate', [
            ...clientCompile('aggregate', 'User'),
            clientSerialize(),
            ...engine([
              ...engineConnection(),
              isMongoDb
                ? dbQuery(expect.stringContaining('db.User.aggregate'))
                : dbQuery(expect.stringContaining('SELECT MAX')),
              ...engineSerialize(),
            ]),
          ]),
        )
      })
    })

    describe('tracing on transactions', () => {
      test('$transaction', async () => {
        const email = faker.internet.email()

        await prisma.$transaction([
          prisma.user.create({
            data: {
              email,
            },
          }),
          prisma.user.findMany({
            where: {
              email,
            },
          }),
        ])

        let expectedDbQueries: Tree[]

        if (isMongoDb) {
          expectedDbQueries = [...createDbQueries(false), findManyDbQuery()]
        } else {
          expectedDbQueries = [...createDbQueries(false), findManyDbQuery()]
          if (engineType === ClientEngineType.Client) {
            expectedDbQueries.push(itxOperation('start'))
            expectedDbQueries.unshift(itxOperation('commit'))
          } else {
            expectedDbQueries.push(txCommit())
          }
          if (!usesJsDrivers) {
            // Driver adapters do not issue BEGIN through the query engine.
            expectedDbQueries.unshift(txBegin())
          }
          if (isSqlServer && !usesJsDrivers) {
            expectedDbQueries.unshift(txSetIsolationLevel())
          }
        }

        await waitForSpanTree({
          name: 'prisma:client:transaction',
          attributes: {
            method: '$transaction',
          },
          children: [
            operation('User', 'create', [
              ...clientCompileBatch(['createOne', 'findMany'], ['User', 'User']),
              clientSerialize(),
              ...engine([
                ...engineConnection(),
                ...expectedDbQueries,
                ...engineSerializeFinalResponse(),
                ...engineSerializeQueryResult(),
                ...engineSerializeQueryResult(),
              ]),
            ]),
            operation('User', 'findMany', [clientSerialize()]),
          ],
        })
      })

      test('interactive transaction commit', async () => {
        const email = faker.internet.email()

        await prisma.$transaction(async (client) => {
          await client.user.create({
            data: {
              email,
            },
          })
          await client.user.findMany({
            where: {
              email,
            },
          })
        })

        await waitForSpanTree({
          name: 'prisma:client:transaction',
          attributes: {
            method: '$transaction',
          },
          children: [
            operation('User', 'create', [
              ...clientCompile('createOne', 'User'),
              clientSerialize(),
              ...engine([
                ...createDbQueries(false),
                ...engineSerializeFinalResponse(),
                ...engineSerializeQueryResult(),
              ]),
            ]),
            operation('User', 'findMany', [
              ...clientCompile('findMany', 'User'),
              clientSerialize(),
              ...engine([findManyDbQuery(), ...engineSerializeFinalResponse(), ...engineSerializeQueryResult()]),
            ]),
            itxOperation('commit'),
            itxOperation('start'),
          ],
        })
      })

      test('interactive transaction rollback', async () => {
        const email = faker.internet.email()

        await prisma
          .$transaction(async (client) => {
            await client.user.create({
              data: {
                email,
              },
            })
            await client.user.findMany({
              where: {
                email,
              },
            })
            throw new Error('rollback')
          })
          .catch(() => {})

        await waitForSpanTree({
          name: 'prisma:client:transaction',
          attributes: {
            method: '$transaction',
          },
          children: [
            operation('User', 'create', [
              ...clientCompile('createOne', 'User'),
              clientSerialize(),
              ...engine([
                ...createDbQueries(false),
                ...engineSerializeFinalResponse(),
                ...engineSerializeQueryResult(),
              ]),
            ]),
            operation('User', 'findMany', [
              ...clientCompile('findMany', 'User'),
              clientSerialize(),
              ...engine([findManyDbQuery(), ...engineSerializeFinalResponse(), ...engineSerializeQueryResult()]),
            ]),
            itxOperation('rollback'),
            itxOperation('start'),
          ],
        })
      })
    })

    describeIf(provider !== Providers.MONGODB)('tracing on $raw methods', () => {
      test('$queryRaw', async () => {
        // @ts-test-if: provider !== Providers.MONGODB
        await prisma.$queryRaw`SELECT 1 + 1;`
        await waitForSpanTree(
          operation(undefined, 'queryRaw', [
            ...clientCompile('queryRaw'),
            clientSerialize(),
            ...engine([...engineConnection(), dbQuery('SELECT 1 + 1;'), ...engineSerialize()]),
          ]),
        )
      })

      test('$executeRaw', async () => {
        // Raw query failed. Code: `N/A`. Message: `Execute returned results, which is not allowed in SQLite.`
        if (provider === Providers.SQLITE || isMongoDb) {
          return
        }

        // @ts-test-if: provider !== Providers.MONGODB
        await prisma.$executeRaw`SELECT 1 + 1;`

        await waitForSpanTree(
          operation(undefined, 'executeRaw', [
            ...clientCompile('executeRaw'),
            clientSerialize(),
            ...engine([
              ...engineConnection(),
              dbQuery('SELECT 1 + 1;', AdapterQueryChildSpans.ArgsOnly),
              ...engineSerialize(),
            ]),
          ]),
        )
      })
    })

    test('tracing with custom span', async () => {
      const tracer = trace.getTracer('MyApp')
      const email = faker.internet.email()

      await tracer.startActiveSpan('create-user', async (span) => {
        try {
          return await prisma.user.create({
            data: {
              email: email,
            },
          })
        } finally {
          span.end()
        }
      })

      await waitForSpanTree({
        name: 'create-user',
        children: [
          operation('User', 'create', [
            ...clientCompile('createOne', 'User'),
            clientSerialize(),
            ...engine([...engineConnection(), ...createDbQueries(), ...engineSerialize()]),
          ]),
        ],
      })
    })

    // $connect is a no-op with Data Proxy
    describeIf(!clientMeta.dataProxy)('tracing connect', () => {
      let _prisma: PrismaClient

      beforeEach(() => {
        _prisma = newPrismaClient()
      })

      afterEach(async () => {
        await _prisma.$disconnect()
      })

      test('should trace the implicit $connect call', async () => {
        const email = faker.internet.email()

        await _prisma.user.findMany({
          where: {
            email: email,
          },
        })

        await waitForSpanTree([
          ...detectPlatform(),
          ...loadEngine(),
          operation('User', 'findMany', [
            ...clientCompile('findMany', 'User'),
            {
              name: 'prisma:client:connect',
              children: engineConnect(),
            },
            clientSerialize(),
            ...engine([...engineConnection(), findManyDbQuery(), ...engineSerialize()]),
          ]),
        ])
      })

      test('should trace the explicit $connect call', async () => {
        await _prisma.$connect()

        await waitForSpanTree([
          {
            name: 'prisma:client:connect',
            children: engineConnect(),
          },
          ...detectPlatform(),
          ...loadEngine(),
        ])
      })
    })

    // $disconnect is a no-op with Data Proxy
    describeIf(!clientMeta.dataProxy)('tracing disconnect', () => {
      let _prisma: PrismaClient

      beforeAll(async () => {
        _prisma = newPrismaClient()
        await _prisma.$connect()
      })

      test('should trace $disconnect', async () => {
        await _prisma.$disconnect()

        await waitForSpanTree({
          name: 'prisma:client:disconnect',
          // There's no disconnect method in the binary engine, we terminate the process instead.
          // Since we immediately close the pipe, there's no chance to get any spans we could
          // emit from a signal handler.
          children: engineType === ClientEngineType.Library ? [{ name: 'prisma:engine:disconnect' }] : undefined,
        })
      })
    })
  },
  {
    skipDriverAdapter: {
      from: [AdapterProviders.JS_D1],
      reason:
        'js_d1: Errors with D1_ERROR: A prepared SQL statement must contain only one statement. See https://github.com/prisma/team-orm/issues/880  https://github.com/cloudflare/workers-sdk/issues/3892#issuecomment-1912102659',
    },
  },
)
