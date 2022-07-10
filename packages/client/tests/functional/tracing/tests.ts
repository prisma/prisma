import { faker } from '@faker-js/faker'
import * as api from '@opentelemetry/api'
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
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
  (suiteConfig) => {
    let inMemorySpanExporter: InMemorySpanExporter
    let otlpTraceExporter: OTLPTraceExporter
    let basicTracerProvider: BasicTracerProvider

    beforeAll(() => {
      const contextManager = new AsyncHooksContextManager().enable()
      api.context.setGlobalContextManager(contextManager)

      otlpTraceExporter = new OTLPTraceExporter()
      inMemorySpanExporter = new InMemorySpanExporter()

      basicTracerProvider = new BasicTracerProvider({
        resource: new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: 'test-name',
          [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
        }),
      })

      basicTracerProvider.addSpanProcessor(new SimpleSpanProcessor(otlpTraceExporter))
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
      await otlpTraceExporter?.shutdown()
      await basicTracerProvider?.shutdown()
    })

    describe('tracing on crud', () => {
      const email = faker.internet.email()

      test('create', async () => {
        await prisma.user.create({
          data: {
            email: email,
          },
        })

        const spans = inMemorySpanExporter.getFinishedSpans()
        const rootSpan = spans.find((span) => !span.parentSpanId) as ReadableSpan
        const tree = buildTree({ span: rootSpan }, spans)

        if (suiteConfig.provider === 'mongodb') {
          // todo
        } else {
          expect(tree.span.name).toEqual('prisma')
          expect(tree.span.attributes['method']).toEqual('create')
          expect(tree.span.attributes['model']).toEqual('User')

          expect(tree.children).toHaveLength(1)

          const engine = (tree?.children || [])[0] as unknown as Tree
          expect(engine.span.name).toEqual('prisma:engine:query')

          expect(engine.children).toHaveLength(5)

          const getConnection = (engine.children || [])[0]
          expect(getConnection.span.name).toEqual('engine:get_connection')

          const quaint1 = (engine.children || [])[1]
          expect(quaint1.span.name).toEqual('quaint:query')
          expect(quaint1.span.attributes['query']).toEqual('BEGIN')

          const quaint2 = (engine.children || [])[2]
          expect(quaint2.span.name).toEqual('quaint:query')
          expect(quaint2.span.attributes['query']).toContain('INSERT')

          const quaint3 = (engine.children || [])[3]
          expect(quaint3.span.name).toEqual('quaint:query')
          expect(quaint3.span.attributes['query']).toContain('SELECT')

          const quaint4 = (engine.children || [])[4]
          expect(quaint4.span.name).toEqual('quaint:query')
          expect(quaint4.span.attributes['query']).toContain('COMMIT')
        }
      })

      test('read', async () => {
        await prisma.user.findMany({
          where: {
            email: email,
          },
        })

        const spans = inMemorySpanExporter.getFinishedSpans()
        const rootSpan = spans.find((span) => !span.parentSpanId) as ReadableSpan
        const tree = buildTree({ span: rootSpan }, spans)

        if (suiteConfig.provider === 'mongodb') {
          // todo
        } else {
          expect(tree.span.name).toEqual('prisma')
          expect(tree.span.attributes['method']).toEqual('findMany')
          expect(tree.span.attributes['model']).toEqual('User')

          expect(tree.children).toHaveLength(1)

          const engine = (tree?.children || [])[0] as unknown as Tree
          expect(engine.span.name).toEqual('prisma:engine:query')

          expect(engine.children).toHaveLength(2)

          const getConnection = (engine.children || [])[0]
          expect(getConnection.span.name).toEqual('engine:get_connection')

          const select = (engine.children || [])[1]
          expect(select.span.name).toEqual('quaint:query')
          expect(select.span.attributes['query']).toContain('SELECT')
        }
      })

      test('update', async () => {
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

        if (suiteConfig.provider === 'mongodb') {
          // todo
        } else {
          expect(tree.span.name).toEqual('prisma')
          expect(tree.span.attributes['method']).toEqual('update')
          expect(tree.span.attributes['model']).toEqual('User')

          expect(tree.children).toHaveLength(1)

          const engine = (tree?.children || [])[0] as unknown as Tree
          expect(engine.span.name).toEqual('prisma:engine:query')

          expect(engine.children).toHaveLength(6)

          const getConnection = (engine.children || [])[0]
          expect(getConnection.span.name).toEqual('engine:get_connection')

          const quaint1 = (engine.children || [])[1]
          expect(quaint1.span.name).toEqual('quaint:query')
          expect(quaint1.span.attributes['query']).toEqual('BEGIN')

          const quaint2 = (engine.children || [])[2]
          expect(quaint2.span.name).toEqual('quaint:query')
          expect(quaint2.span.attributes['query']).toContain('SELECT')

          const quaint3 = (engine.children || [])[3]
          expect(quaint3.span.name).toEqual('quaint:query')
          expect(quaint3.span.attributes['query']).toContain('UPDATE')

          const quaint4 = (engine.children || [])[4]
          expect(quaint4.span.name).toEqual('quaint:query')
          expect(quaint4.span.attributes['query']).toContain('SELECT')

          const quaint5 = (engine.children || [])[5]
          expect(quaint5.span.name).toEqual('quaint:query')
          expect(quaint5.span.attributes['query']).toContain('COMMIT')
        }
      })

      test('delete', async () => {
        await prisma.user.delete({
          where: {
            email: email,
          },
        })

        const spans = inMemorySpanExporter.getFinishedSpans()
        const rootSpan = spans.find((span) => !span.parentSpanId) as ReadableSpan
        const tree = buildTree({ span: rootSpan }, spans)

        if (suiteConfig.provider === 'mongodb') {
          // todo
        } else {
          expect(tree.span.name).toEqual('prisma')
          expect(tree.span.attributes['method']).toEqual('delete')
          expect(tree.span.attributes['model']).toEqual('User')

          expect(tree.children).toHaveLength(1)

          const engine = (tree?.children || [])[0] as unknown as Tree
          expect(engine.span.name).toEqual('prisma:engine:query')

          expect(engine.children).toHaveLength(6)

          const getConnection = (engine.children || [])[0]
          expect(getConnection.span.name).toEqual('engine:get_connection')

          const quaint1 = (engine.children || [])[1]
          expect(quaint1.span.name).toEqual('quaint:query')
          expect(quaint1.span.attributes['query']).toEqual('BEGIN')

          const quaint2 = (engine.children || [])[2]
          expect(quaint2.span.name).toEqual('quaint:query')
          expect(quaint2.span.attributes['query']).toContain('SELECT')

          const quaint3 = (engine.children || [])[3]
          expect(quaint3.span.name).toEqual('quaint:query')
          expect(quaint3.span.attributes['query']).toContain('SELECT')

          const quaint4 = (engine.children || [])[4]
          expect(quaint4.span.name).toEqual('quaint:query')
          expect(quaint4.span.attributes['query']).toContain('DELETE')

          const quaint5 = (engine.children || [])[5]
          expect(quaint5.span.name).toEqual('quaint:query')
          expect(quaint5.span.attributes['query']).toContain('COMMIT')
        }
      })
    })

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

        switch (suiteConfig.provider) {
          case 'postgresql': {
            expect(tree.span.name).toEqual('prisma:transaction')
            expect(tree.span.resource.attributes['service.name']).toEqual(SERVICE_NAME)
            expect(tree.span.attributes['method']).toEqual('transaction')

            expect(tree.children).toHaveLength(1)

            const prismaEngineQuery = (tree?.children || [])[0] as unknown as Tree
            expect(prismaEngineQuery.span.name).toEqual('prisma:engine:query')
            expect(prismaEngineQuery.children).toHaveLength(5)

            break
          }

          default:
            throw new Error('invalid provider')
        }
      })

      test('interactive-transactions', async () => {
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

        const spans = inMemorySpanExporter.getFinishedSpans()
        const rootSpan = spans.find((span) => !span.parentSpanId) as ReadableSpan
        const tree = buildTree({ span: rootSpan }, spans)

        switch (suiteConfig.provider) {
          case 'postgresql': {
            expect(tree.span.name).toEqual('prisma:transaction')
            expect(tree.span.resource.attributes['service.name']).toEqual(SERVICE_NAME)
            expect(tree.span.attributes['method']).toEqual('transaction')

            expect(tree.children).toHaveLength(1)

            const prismaEngineQuery = (tree?.children || [])[0] as unknown as Tree
            expect(prismaEngineQuery.span.name).toEqual('prisma:engine:itx')
            expect(prismaEngineQuery.children).toHaveLength(6)

            break
          }

          default:
            throw new Error('invalid provider')
        }
      })
    })

    // describe('tracing on $raw & $runCommandRaw methods', () => {})

    // describe('tracing with custom span', () => {})
  },
  {
    optOut: {
      from: ['sqlite', 'mysql', 'sqlserver', 'cockroachdb', 'mongodb'],
      reason: 'TODO',
    },
  },
)
