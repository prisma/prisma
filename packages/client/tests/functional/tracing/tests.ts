import { Attributes, context, trace } from '@opentelemetry/api'
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { Resource } from '@opentelemetry/resources'
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  ReadableSpan,
  SimpleSpanProcessor,
  SpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { PrismaInstrumentation } from '@prisma/instrumentation'
import { copycat } from '@snaplet/copycat'

import { waitFor } from '../_utils/tests/waitFor'
import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

type Tree = {
  name: string
  attributes?: Attributes
  children?: Tree[]
}

function buildTree(rootSpan: ReadableSpan, spans: ReadableSpan[]): Tree {
  const childrenSpans = spans
    .sort((a, b) => {
      // Ensures fixed order of children spans regardless of the
      // actual timings. Why use name instead of start time? Sometimes
      // things happen in parallel/different order and startTime does not
      // provide stable ordering guarantee.
      return a.name.localeCompare(b.name)
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

  return tree
}

declare let prisma: PrismaClient
declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

let inMemorySpanExporter: InMemorySpanExporter
let processor: SpanProcessor

beforeAll(() => {
  const contextManager = new AsyncHooksContextManager().enable()
  context.setGlobalContextManager(contextManager)

  inMemorySpanExporter = new InMemorySpanExporter()

  const basicTracerProvider = new BasicTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: `test-name`,
      [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
    }),
  })

  processor = new SimpleSpanProcessor(inMemorySpanExporter)
  basicTracerProvider.addSpanProcessor(processor)
  basicTracerProvider.register()

  registerInstrumentations({
    instrumentations: [new PrismaInstrumentation({ middleware: true })],
  })
})

afterAll(() => {
  context.disable()
})

testMatrix.setupTestSuite(
  ({ provider }, suiteMeta, clientMeta) => {
    beforeEach(async () => {
      await prisma.$connect()
      inMemorySpanExporter.reset()
    })

    async function waitForSpanTree(expectedTree: Tree): Promise<void> {
      await waitFor(async () => {
        await processor.forceFlush()
        const spans = inMemorySpanExporter.getFinishedSpans()
        const rootSpan = spans.find((span) => !span.parentSpanId) as ReadableSpan
        const tree = buildTree(rootSpan, spans)

        expect(tree).toEqual(expectedTree)
      })
    }

    function dbQuery(statement: string, hasDriverAdapterResultSpan = true): Tree {
      const span = {
        name: 'prisma:engine:db_query',
        attributes: {
          'db.statement': statement,
        },
      }

      // extra children spans for driver adapters
      if (clientMeta.driverAdapter) {
        const children = [] as Tree[]

        // args span always exists for any query
        children.push({
          name: 'js:query:args',
        })

        // result span only exists for returning queries
        if (hasDriverAdapterResultSpan === true) {
          children.push({
            name: 'js:query:result',
          })
        }

        // sql span always exists for any query
        children.push({
          name: 'js:query:sql',
          attributes: {
            'db.statement': statement,
          },
        })

        span['children'] = children
      }

      return span
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
      return {
        name: 'prisma:engine',
        children,
      }
    }

    function clientSerialize() {
      return { name: 'prisma:client:serialize' }
    }

    function engineSerialize() {
      return { name: 'prisma:engine:serialize' }
    }

    function engineConnection() {
      return { name: 'prisma:engine:connection', attributes: { 'db.type': expect.any(String) } }
    }

    function findManyDbQuery() {
      const statement = provider === 'mongodb' ? 'db.User.findMany(*)' : 'SELECT'

      return dbQuery(expect.stringContaining(statement))
    }

    function createDbQueries(tx = true) {
      if (provider === 'mongodb') {
        return [
          dbQuery(expect.stringContaining('db.User.insertOne(*)')),
          dbQuery(expect.stringContaining('db.User.findOne(*)')),
        ]
      }

      if (['postgresql', 'cockroachdb'].includes(provider)) {
        return [dbQuery(expect.stringContaining('INSERT'))]
      }
      const dbQueries: Tree[] = []
      if (tx) {
        dbQueries.push(dbQuery(expect.stringContaining('BEGIN'), false))
      }

      dbQueries.push(dbQuery(expect.stringContaining('INSERT')), dbQuery(expect.stringContaining('SELECT')))

      if (tx) {
        dbQueries.push(dbQuery('COMMIT', false))
      }
      return dbQueries
    }

    describe('tracing on crud methods', () => {
      let sharedEmail = copycat.email(16)

      test('create', async () => {
        await prisma.user.create({
          data: {
            email: sharedEmail,
          },
        })

        await waitForSpanTree(
          operation('User', 'create', [
            clientSerialize(),
            engine([engineConnection(), ...createDbQueries(), engineSerialize()]),
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
            clientSerialize(),
            engine([engineConnection(), findManyDbQuery(), engineSerialize()]),
          ]),
        )
      })

      test('update', async () => {
        const newEmail = copycat.email(18)

        await prisma.user.update({
          data: {
            email: newEmail,
          },
          where: {
            email: sharedEmail,
          },
        })

        sharedEmail = newEmail

        let dbQueries: Tree[]

        if (provider === 'mongodb') {
          dbQueries = [
            dbQuery(expect.stringContaining('db.User.findMany(*)')),
            dbQuery(expect.stringContaining('db.User.updateMany(*)')),
            dbQuery(expect.stringContaining('db.User.findOne(*)')),
          ]
        } else if (['postgresql', 'cockroachdb'].includes(provider)) {
          dbQueries = [dbQuery(expect.stringContaining('UPDATE'))]
        } else {
          dbQueries = [
            dbQuery(expect.stringContaining('BEGIN'), false),
            dbQuery(expect.stringContaining('SELECT')),
            dbQuery(expect.stringContaining('UPDATE')),
            dbQuery(expect.stringContaining('SELECT')),
            dbQuery('COMMIT', false),
          ]
        }

        await waitForSpanTree(
          operation('User', 'update', [
            clientSerialize(),
            engine([engineConnection(), ...dbQueries, engineSerialize()]),
          ]),
        )
      })

      test('delete', async () => {
        await prisma.user.delete({
          where: {
            email: sharedEmail,
          },
        })

        let dbQueries: Tree[]

        if (provider === 'mongodb') {
          dbQueries = [
            dbQuery(expect.stringContaining('db.User.findOne(*)')),
            dbQuery(expect.stringContaining('db.User.findMany(*)')),
            dbQuery(expect.stringContaining('db.User.deleteMany(*)')),
          ]
        } else {
          dbQueries = [
            dbQuery(expect.stringContaining('BEGIN'), false),
            dbQuery(expect.stringContaining('SELECT')),
            dbQuery(expect.stringContaining('DELETE'), false),
            dbQuery('COMMIT', false),
          ]
        }
        await waitForSpanTree(
          operation('User', 'delete', [
            clientSerialize(),
            engine([engineConnection(), ...dbQueries, engineSerialize()]),
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

        let dbQueries: Tree[]

        if (provider === 'mongodb') {
          dbQueries = [
            dbQuery(expect.stringContaining('db.User.findMany(*)')),
            dbQuery(expect.stringContaining('db.User.deleteMany(*)')),
          ]
        } else {
          dbQueries = [dbQuery(expect.stringContaining('DELETE'), false)]
        }

        await waitForSpanTree(
          operation('User', 'deleteMany', [
            clientSerialize(),
            engine([engineConnection(), ...dbQueries, engineSerialize()]),
          ]),
        )
      })
    })

    describe('tracing on transactions', () => {
      test('$transaction', async () => {
        const email = copycat.email(80)

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

        let dbQueries: Tree[]

        if (provider === 'mongodb') {
          dbQueries = [...createDbQueries(false), findManyDbQuery()]
        } else {
          dbQueries = [
            dbQuery(expect.stringContaining('BEGIN'), false),
            ...createDbQueries(false),
            findManyDbQuery(),
            dbQuery('COMMIT', false),
          ]
        }

        await waitForSpanTree({
          name: 'prisma:client:transaction',
          attributes: {
            method: '$transaction',
          },
          children: [
            operation('User', 'create', [clientSerialize()]),
            operation('User', 'findMany', [clientSerialize()]),
            engine([engineConnection(), ...dbQueries, engineSerialize(), engineSerialize()]),
          ],
        })
      })

      test('interactive-transactions', async () => {
        const email = copycat.email(52)

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

        let txQueries: Tree[] = []

        if (provider !== 'mongodb') {
          txQueries = [dbQuery(expect.stringContaining('BEGIN'), false), dbQuery('COMMIT', false)]
        }

        // skipping on data proxy because the functionality is broken
        // in this case at the moment and `itx_runner` span occasionally does
        // not make it to the client when running via DP.
        // See https://github.com/prisma/prisma/issues/20694
        if (!clientMeta.dataProxy) {
          await waitForSpanTree({
            name: 'prisma:client:transaction',
            attributes: {
              method: '$transaction',
            },
            children: [
              operation('User', 'create', [clientSerialize()]),
              operation('User', 'findMany', [clientSerialize()]),

              {
                name: 'prisma:engine:itx_runner',
                attributes: { itx_id: expect.any(String) },
                children: [
                  engineConnection(),
                  ...txQueries,
                  { name: 'prisma:engine:itx_query_builder', children: [...createDbQueries(false), engineSerialize()] },
                  { name: 'prisma:engine:itx_query_builder', children: [findManyDbQuery(), engineSerialize()] },
                ],
              },
            ],
          })
        }
      })
    })

    describeIf(provider !== 'mongodb')('tracing on $raw methods', () => {
      test('$queryRaw', async () => {
        // @ts-test-if: provider !== 'mongodb'
        await prisma.$queryRaw`SELECT 1 + 1;`
        await waitForSpanTree(
          operation(undefined, 'queryRaw', [
            clientSerialize(),
            engine([engineConnection(), dbQuery('SELECT 1 + 1;', true), engineSerialize()]),
          ]),
        )
      })

      test('$executeRaw', async () => {
        // Raw query failed. Code: `N/A`. Message: `Execute returned results, which is not allowed in SQLite.`
        if (provider === 'sqlite' || provider === 'mongodb') {
          return
        }

        // @ts-test-if: provider !== 'mongodb'
        await prisma.$executeRaw`SELECT 1 + 1;`

        await waitForSpanTree(
          operation(undefined, 'executeRaw', [
            clientSerialize(),
            engine([engineConnection(), dbQuery('SELECT 1 + 1;', false), engineSerialize()]),
          ]),
        )
      })
    })

    test('tracing with custom span', async () => {
      const tracer = trace.getTracer('MyApp')
      const email = copycat.email(53)

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
            clientSerialize(),
            engine([engineConnection(), ...createDbQueries(), engineSerialize()]),
          ]),
        ],
      })
    })

    describe('tracing with middleware', () => {
      let _prisma: PrismaClient

      beforeAll(async () => {
        _prisma = newPrismaClient()

        await _prisma.$connect()
      })

      test('should succeed', async () => {
        const email = copycat.email(97)

        _prisma.$use(async (params, next) => {
          // Manipulate params here
          const result = await next(params)
          // See results here
          return result
        })
        _prisma.$use(async (params, next) => {
          // Manipulate params here
          const result = await next(params)
          // See results here
          return result
        })

        await _prisma.user.create({
          data: {
            email: email,
          },
        })

        await waitForSpanTree(
          operation('User', 'create', [
            { name: 'prisma:client:middleware', attributes: { method: '$use' } },
            { name: 'prisma:client:middleware', attributes: { method: '$use' } },
            clientSerialize(),
            engine([engineConnection(), ...createDbQueries(), engineSerialize()]),
          ]),
        )
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
        const email = copycat.email(52)

        await _prisma.user.findMany({
          where: {
            email: email,
          },
        })

        await waitForSpanTree(
          operation('User', 'findMany', [
            { name: 'prisma:client:connect' },
            clientSerialize(),
            engine([engineConnection(), findManyDbQuery(), engineSerialize()]),
          ]),
        )
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

        await waitForSpanTree({ name: 'prisma:client:disconnect' })
      })
    })
  },
  {
    skipProviderFlavor: {
      from: ['js_libsql'],
      reason:
        'The spans are not consistent, or not in a way that makes sense compared to the order driver adapters. Needs investigation.',
    },
  },
)
