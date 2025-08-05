import { context } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { Resource } from '@opentelemetry/resources'
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { PrismaInstrumentation } from '@prisma/instrumentation'

import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

let prisma: PrismaClient<'query'>
declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

let inMemorySpanExporter: InMemorySpanExporter

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

  basicTracerProvider.addSpanProcessor(new SimpleSpanProcessor(inMemorySpanExporter))
  basicTracerProvider.register()

  registerInstrumentations({
    instrumentations: [
      new PrismaInstrumentation({
        middleware: true,
        ignoreSpanTypes: ['prisma:engine:connection', /prisma:client:operat.*/, 'prisma:client:db_query'],
      }),
    ],
  })
})

afterAll(() => {
  context.disable()
})

testMatrix.setupTestSuite(
  ({ clientRuntime, engineType }) => {
    beforeAll(() => {
      inMemorySpanExporter.reset()
      prisma = newPrismaClient({ log: [{ emit: 'event', level: 'query' }] })
    })

    test('should filter out spans and their children based on name', async () => {
      await prisma.$connect()
      await prisma.user.findMany()

      const spans = inMemorySpanExporter.getFinishedSpans()

      const expectedSpans = [
        'prisma:client:detect_platform',
        'prisma:client:load_engine',
        // 'prisma:engine:connection',                  <-- Filtered out individually
        'prisma:engine:connect',
        'prisma:client:connect',
        'prisma:client:serialize',
        // 'prisma:engine:connection',                  <-- Child span of filtered out parent span 'prisma:engine:query'
        // 'prisma:engine:db_query',                    <-- Child span of filtered out parent span 'prisma:engine:query'
        // 'prisma:engine:serialize',                   <-- Child span of filtered out parent span 'prisma:engine:query'
        // 'prisma:engine:response_json_serialization', <-- Child span of filtered out parent span 'prisma:engine:query'
        // 'prisma:engine:query',                       <-- Child span of filtered out parent span 'prisma:client:operation'
        // 'prisma:client:operation',                   <-- Filtered out parent span (by regex)
      ]

      if (clientRuntime === 'wasm-engine-edge') {
        expectedSpans.shift() // With wasm we do not perform platform detection
      } else if (engineType === 'client') {
        expectedSpans.splice(0, 3) // Client engine performs no binary engine related spans
      }

      expect(spans.map((span) => span.name)).toEqual(expectedSpans)
    })
  },
  {
    skipDefaultClientInstance: true,
    skipDataProxy: {
      runtimes: ['edge', 'node', 'wasm-engine-edge', 'wasm-compiler-edge', 'client'],
      reason: 'Data proxy creates different traces',
    },
  },
)
