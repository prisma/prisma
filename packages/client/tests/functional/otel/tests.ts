import * as api from '@opentelemetry/api'
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { Resource } from '@opentelemetry/resources'
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  ReadableSpan,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'

import testMatrix from './_matrix'

const SERVICE_NAME = 'test-tracing-service'

export function getExporter(): InMemorySpanExporter {
  const contextManager = new AsyncHooksContextManager().enable()

  api.context.setGlobalContextManager(contextManager)

  const otlpTraceExporter = new OTLPTraceExporter()

  const provider = new BasicTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
      [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
    }),
  })

  const inMemory = new InMemorySpanExporter()
  provider.addSpanProcessor(new SimpleSpanProcessor(otlpTraceExporter))
  provider.addSpanProcessor(new SimpleSpanProcessor(inMemory))
  provider.register()

  return inMemory
}

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
    let exporter: InMemorySpanExporter

    beforeAll(() => {
      exporter = getExporter()
    })

    afterEach(() => {
      exporter?.reset()
    })

    test('create', async () => {
      const email = 'some-random-email@email.com'

      await prisma.user.create({
        data: {
          email: email,
        },
      })

      const spans = exporter.getFinishedSpans()
      const rootSpan = spans.find((span) => !span.parentSpanId) as ReadableSpan
      const tree = buildTree({ span: rootSpan }, spans)

      switch (suiteConfig.provider) {
        case 'postgresql': {
          expect(tree.span.name).toEqual('prisma:client')
          expect(tree.span.resource.attributes['service.name']).toEqual(SERVICE_NAME)
          expect(tree.span.attributes['method']).toEqual('create')
          expect(tree.span.attributes['model']).toEqual('User')

          expect(tree.children).toHaveLength(1)

          const engine = (tree?.children || [])[0] as unknown as Tree
          expect(engine.span.name).toEqual('prisma:engine')

          expect(engine.children).toHaveLength(5)

          const getConnection = (engine.children || [])[0]
          expect(getConnection.span.name).toEqual('engine:get_connection')

          const quaint2 = (engine.children || [])[1]
          expect(quaint2.span.name).toEqual('quaint:query')
          expect(quaint2.span.attributes['query']).toEqual('BEGIN')

          const quaint3 = (engine.children || [])[2]
          expect(quaint3.span.name).toEqual('quaint:query')
          expect(quaint3.span.attributes['query']).toContain(
            'INSERT INTO "public"."User" ("email") VALUES ($1) RETURNING "public"."User"."id"',
          )

          const quaint4 = (engine.children || [])[3]
          expect(quaint4.span.name).toEqual('quaint:query')
          expect(quaint4.span.attributes['query']).toContain(
            'SELECT "public"."User"."id", "public"."User"."email" FROM "public"."User" WHERE "public"."User"."id" = $1 LIMIT $2 OFFSET $3',
          )

          const quaint5 = (engine.children || [])[4]
          expect(quaint5.span.name).toEqual('quaint:query')
          expect(quaint5.span.attributes['query']).toContain('COMMIT')

          break
        }

        default:
          throw new Error('invalid provider')
      }
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mysql', 'sqlserver', 'cockroachdb', 'mongodb'],
      reason: 'TODO',
    },
  },
)
