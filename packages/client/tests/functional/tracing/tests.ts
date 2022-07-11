import { faker } from '@faker-js/faker'
import { context, trace } from '@opentelemetry/api'
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { Resource } from '@opentelemetry/resources'
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  ReadableSpan,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { PrismaInstrumentation } from '@prisma/instrumentation'

import testMatrix from './_matrix'

type Tree = {
  span: ReadableSpan
  children?: Tree[]
}

function buildTree(tree: Tree, spans: ReadableSpan[]): Tree {
  const childrenSpans = spans.filter((span) => span.parentSpanId === tree.span.spanContext().spanId)
  if (childrenSpans.length) {
    tree.children = childrenSpans.map((span) => buildTree({ span }, spans))
  } else {
    tree.children = []
  }

  return tree
}

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(
  () => {
    let inMemorySpanExporter: InMemorySpanExporter
    let basicTracerProvider: BasicTracerProvider

    beforeAll(() => {
      const contextManager = new AsyncHooksContextManager().enable()
      context.setGlobalContextManager(contextManager)

      inMemorySpanExporter = new InMemorySpanExporter()

      basicTracerProvider = new BasicTracerProvider({
        resource: new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: 'test-name',
          [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
        }),
      })

      basicTracerProvider.addSpanProcessor(new SimpleSpanProcessor(inMemorySpanExporter))
      basicTracerProvider.register()

      registerInstrumentations({
        instrumentations: [new PrismaInstrumentation()],
      })
    })

    afterEach(async () => {
      inMemorySpanExporter.reset()
      await basicTracerProvider.forceFlush()
    })

    afterAll(async () => {
      await inMemorySpanExporter?.shutdown()
      await basicTracerProvider?.shutdown()
    })

    describe('tracing on crud methods', () => {
      const email = faker.internet.email()

      test('create', async () => {
        // TODO - remove when engines are merged
        if (process.env.CI) return

        await prisma.user.create({
          data: {
            email: email,
          },
        })

        const spans = inMemorySpanExporter.getFinishedSpans()
        const rootSpan = spans.find((span) => !span.parentSpanId) as ReadableSpan
        const tree = buildTree({ span: rootSpan }, spans)

        expect(tree.span.name).toEqual('prisma')
        expect(tree.span.attributes['method']).toEqual('create')
        expect(tree.span.attributes['model']).toEqual('User')

        expect(tree.children).toHaveLength(1)

        const engine = (tree?.children || [])[0] as unknown as Tree
        expect(engine.span.name).toEqual('prisma:query_builder')

        expect(engine.children).toHaveLength(5)

        const getConnection = (engine.children || [])[0]
        expect(getConnection.span.name).toEqual('prisma:connection')

        const dbQuery1 = (engine.children || [])[1]
        expect(dbQuery1.span.name).toEqual('prisma:db_query')
        expect(dbQuery1.span.attributes['db.statement']).toEqual('BEGIN')

        const dbQuery2 = (engine.children || [])[2]
        expect(dbQuery2.span.name).toEqual('prisma:db_query')
        expect(dbQuery2.span.attributes['db.statement']).toContain('INSERT')

        const dbQuery3 = (engine.children || [])[3]
        expect(dbQuery3.span.name).toEqual('prisma:db_query')
        expect(dbQuery3.span.attributes['db.statement']).toContain('SELECT')

        const dbQuery4 = (engine.children || [])[4]
        expect(dbQuery4.span.name).toEqual('prisma:db_query')
        expect(dbQuery4.span.attributes['db.statement']).toContain('COMMIT')
      })

      test('read', async () => {
        // TODO - remove when engines are merged
        if (process.env.CI) return

        await prisma.user.findMany({
          where: {
            email: email,
          },
        })

        const spans = inMemorySpanExporter.getFinishedSpans()
        const rootSpan = spans.find((span) => !span.parentSpanId) as ReadableSpan
        const tree = buildTree({ span: rootSpan }, spans)

        expect(tree.span.name).toEqual('prisma')
        expect(tree.span.attributes['method']).toEqual('findMany')
        expect(tree.span.attributes['model']).toEqual('User')

        expect(tree.children).toHaveLength(1)

        const engine = (tree?.children || [])[0] as unknown as Tree
        expect(engine.span.name).toEqual('prisma:query_builder')

        expect(engine.children).toHaveLength(2)

        const getConnection = (engine.children || [])[0]
        expect(getConnection.span.name).toEqual('prisma:connection')

        const select = (engine.children || [])[1]
        expect(select.span.name).toEqual('prisma:db_query')
        expect(select.span.attributes['db.statement']).toContain('SELECT')
      })

      test('update', async () => {
        // TODO - remove when engines are merged
        if (process.env.CI) return

        await prisma.user.update({
          data: {
            email: email,
          },
          where: {
            email: email,
          },
        })

        const spans = inMemorySpanExporter.getFinishedSpans()
        const rootSpan = spans.find((span) => !span.parentSpanId) as ReadableSpan
        const tree = buildTree({ span: rootSpan }, spans)

        expect(tree.span.name).toEqual('prisma')
        expect(tree.span.attributes['method']).toEqual('update')
        expect(tree.span.attributes['model']).toEqual('User')

        expect(tree.children).toHaveLength(1)

        const engine = (tree?.children || [])[0] as unknown as Tree
        expect(engine.span.name).toEqual('prisma:query_builder')

        expect(engine.children).toHaveLength(6)

        const getConnection = (engine.children || [])[0]
        expect(getConnection.span.name).toEqual('prisma:connection')

        const dbQuery1 = (engine.children || [])[1]
        expect(dbQuery1.span.name).toEqual('prisma:db_query')
        expect(dbQuery1.span.attributes['db.statement']).toEqual('BEGIN')

        const dbQuery2 = (engine.children || [])[2]
        expect(dbQuery2.span.name).toEqual('prisma:db_query')
        expect(dbQuery2.span.attributes['db.statement']).toContain('SELECT')

        const dbQuery3 = (engine.children || [])[3]
        expect(dbQuery3.span.name).toEqual('prisma:db_query')
        expect(dbQuery3.span.attributes['db.statement']).toContain('UPDATE')

        const dbQuery4 = (engine.children || [])[4]
        expect(dbQuery4.span.name).toEqual('prisma:db_query')
        expect(dbQuery4.span.attributes['db.statement']).toContain('SELECT')

        const dbQuery5 = (engine.children || [])[5]
        expect(dbQuery5.span.name).toEqual('prisma:db_query')
        expect(dbQuery5.span.attributes['db.statement']).toContain('COMMIT')
      })

      test('delete', async () => {
        // TODO - remove when engines are merged
        if (process.env.CI) return

        await prisma.user.delete({
          where: {
            email: email,
          },
        })

        const spans = inMemorySpanExporter.getFinishedSpans()
        const rootSpan = spans.find((span) => !span.parentSpanId) as ReadableSpan
        const tree = buildTree({ span: rootSpan }, spans)

        expect(tree.span.name).toEqual('prisma')
        expect(tree.span.attributes['method']).toEqual('delete')
        expect(tree.span.attributes['model']).toEqual('User')

        expect(tree.children).toHaveLength(1)

        const engine = (tree?.children || [])[0] as unknown as Tree
        expect(engine.span.name).toEqual('prisma:query_builder')

        expect(engine.children).toHaveLength(6)

        const getConnection = (engine.children || [])[0]
        expect(getConnection.span.name).toEqual('prisma:connection')

        const dbQuery1 = (engine.children || [])[1]
        expect(dbQuery1.span.name).toEqual('prisma:db_query')
        expect(dbQuery1.span.attributes['db.statement']).toEqual('BEGIN')

        const dbQuery2 = (engine.children || [])[2]
        expect(dbQuery2.span.name).toEqual('prisma:db_query')
        expect(dbQuery2.span.attributes['db.statement']).toContain('SELECT')

        const dbQuery3 = (engine.children || [])[3]
        expect(dbQuery3.span.name).toEqual('prisma:db_query')
        expect(dbQuery3.span.attributes['db.statement']).toContain('SELECT')

        const dbQuery4 = (engine.children || [])[4]
        expect(dbQuery4.span.name).toEqual('prisma:db_query')
        expect(dbQuery4.span.attributes['db.statement']).toContain('DELETE')

        const dbQuery5 = (engine.children || [])[5]
        expect(dbQuery5.span.name).toEqual('prisma:db_query')
        expect(dbQuery5.span.attributes['db.statement']).toContain('COMMIT')
      })
    })

    // TODO broken
    describe.skip('tracing on transactions', () => {
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

        const spans = inMemorySpanExporter.getFinishedSpans()
        const rootSpan = spans.find((span) => !span.parentSpanId) as ReadableSpan
        const tree = buildTree({ span: rootSpan }, spans)

        expect(tree.span.name).toEqual('prisma:transaction')
        expect(tree.span.attributes['method']).toEqual('transaction')

        expect(tree.children).toHaveLength(1)

        const prismaEngineQuery = (tree?.children || [])[0] as unknown as Tree
        expect(prismaEngineQuery.span.name).toEqual('prisma:query_builder')
        expect(prismaEngineQuery.children).toHaveLength(5)
      })

      test('interactive-transactions', async () => {
        const email = faker.internet.email()

        // @ts-ignore
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

        const spans = inMemorySpanExporter.getFinishedSpans()
        const rootSpan = spans.find((span) => !span.parentSpanId) as ReadableSpan
        const tree = buildTree({ span: rootSpan }, spans)

        expect(tree.span.name).toEqual('prisma:transaction')
        expect(tree.span.attributes['method']).toEqual('transaction')

        expect(tree.children).toHaveLength(1)

        const prismaEngineQuery = (tree?.children || [])[0] as unknown as Tree
        expect(prismaEngineQuery.span.name).toEqual('prisma:engine:itx')
        expect(prismaEngineQuery.children).toHaveLength(6)
      })
    })

    describe('tracing on $raw methods', () => {
      test('$queryRaw', async () => {
        // TODO - remove when engines are merged
        if (process.env.CI) return

        await prisma.$queryRaw`SELECT 1 + 1;`

        const spans = inMemorySpanExporter.getFinishedSpans()
        const rootSpan = spans.find((span) => !span.parentSpanId) as ReadableSpan
        const tree = buildTree({ span: rootSpan }, spans)

        expect(tree.span.name).toEqual('prisma')
        expect(tree.span.attributes['method']).toEqual('queryRaw')

        expect(tree.children).toHaveLength(1)

        const engine = (tree?.children || [])[0] as unknown as Tree
        expect(engine.span.name).toEqual('prisma:query_builder')

        expect(engine.children).toHaveLength(2)

        const getConnection = (engine.children || [])[0]
        expect(getConnection.span.name).toEqual('prisma:connection')

        const dbQuery1 = (engine.children || [])[1]
        expect(dbQuery1.span.name).toEqual('prisma:db_query')
        expect(dbQuery1.span.attributes['db.statement']).toEqual('SELECT 1 + 1;')
      })

      test('$executeRaw', async () => {
        // TODO - remove when engines are merged
        if (process.env.CI) return

        await prisma.$executeRaw`SELECT 1 + 1;`

        const spans = inMemorySpanExporter.getFinishedSpans()
        const rootSpan = spans.find((span) => !span.parentSpanId) as ReadableSpan
        const tree = buildTree({ span: rootSpan }, spans)

        expect(tree.span.name).toEqual('prisma')
        expect(tree.span.attributes['method']).toEqual('executeRaw')

        expect(tree.children).toHaveLength(1)

        const engine = (tree?.children || [])[0] as unknown as Tree
        expect(engine.span.name).toEqual('prisma:query_builder')

        expect(engine.children).toHaveLength(2)

        const getConnection = (engine.children || [])[0]
        expect(getConnection.span.name).toEqual('prisma:connection')

        const dbQuery1 = (engine.children || [])[1]
        expect(dbQuery1.span.name).toEqual('prisma:db_query')
        expect(dbQuery1.span.attributes['db.statement']).toEqual('SELECT 1 + 1;')
      })
    })

    test('tracing with custom span', async () => {
      // TODO - remove when engines are merged
      if (process.env.CI) return

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

      const spans = inMemorySpanExporter.getFinishedSpans()
      const rootSpan = spans.find((span) => !span.parentSpanId) as ReadableSpan
      const tree = buildTree({ span: rootSpan }, spans)

      expect(tree.span.name).toEqual('create-user')

      const prismaSpan = (tree.children || [])[0]

      expect(prismaSpan.span.name).toEqual('prisma')
      expect(prismaSpan.span.attributes['method']).toEqual('create')
      expect(prismaSpan.span.attributes['model']).toEqual('User')

      expect(prismaSpan.children).toHaveLength(1)

      const engine = (prismaSpan?.children || [])[0] as unknown as Tree
      expect(engine.span.name).toEqual('prisma:query_builder')

      expect(engine.children).toHaveLength(5)

      const getConnection = (engine.children || [])[0]
      expect(getConnection.span.name).toEqual('prisma:connection')

      const dbQuery1 = (engine.children || [])[1]
      expect(dbQuery1.span.name).toEqual('prisma:db_query')
      expect(dbQuery1.span.attributes['db.statement']).toEqual('BEGIN')

      const dbQuery2 = (engine.children || [])[2]
      expect(dbQuery2.span.name).toEqual('prisma:db_query')
      expect(dbQuery2.span.attributes['db.statement']).toContain('INSERT')

      const dbQuery3 = (engine.children || [])[3]
      expect(dbQuery3.span.name).toEqual('prisma:db_query')
      expect(dbQuery3.span.attributes['db.statement']).toContain('SELECT')

      const dbQuery4 = (engine.children || [])[4]
      expect(dbQuery4.span.name).toEqual('prisma:db_query')
      expect(dbQuery4.span.attributes['db.statement']).toContain('COMMIT')
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mysql', 'sqlserver', 'cockroachdb', 'mongodb'],
      reason: 'TODO',
    },
  },
)
