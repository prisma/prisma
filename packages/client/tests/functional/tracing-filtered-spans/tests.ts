import { context } from '@opentelemetry/api'
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { Resource } from '@opentelemetry/resources'
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { PrismaInstrumentation } from '@prisma/instrumentation'

import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

let prisma: PrismaClient<{ log: [{ emit: 'event'; level: 'query' }] }>
declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

let inMemorySpanExporter: InMemorySpanExporter

beforeAll(() => {
  const contextManager = new AsyncHooksContextManager().enable()
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
        ignoreSpanTypes: [/prisma:client:ser.*/, 'prisma:client:connect', 'prisma:engine:query'],
      }),
    ],
  })
})

afterAll(() => {
  context.disable()
})

testMatrix.setupTestSuite(
  () => {
    beforeAll(() => {
      inMemorySpanExporter.reset()
      prisma = newPrismaClient({ log: [{ emit: 'event', level: 'query' }] })
    })

    test('should filter out spans and their children based on name', async () => {
      await prisma.user.findMany()

      const spans = inMemorySpanExporter.getFinishedSpans()

      const expectedSpans = [
        'prisma:client:detect_platform',
        'prisma:client:load_engine',
        // 'prisma:client:serialize',                   <-- Filtered out by regex
        'prisma:engine:connection',
        'prisma:engine:connect',
        // 'prisma:client:connect',                     <-- Filtered out individually
        // 'prisma:engine:connection',                  <-- Child span of filtered out parent span
        // 'prisma:engine:db_query',                    <-- Child span of filtered out parent span
        // 'prisma:engine:serialize',                   <-- Child span of filtered out parent span
        // 'prisma:engine:response_json_serialization', <-- Child span of filtered out parent span
        // 'prisma:engine:query',                       <-- Filtered out parent span
        'prisma:client:operation',
      ]

      expect(spans.map((span) => span.name)).toEqual(expectedSpans)
    })
  },
  {
    skipDefaultClientInstance: true,
    skipDataProxy: {
      runtimes: ['edge', 'node', 'wasm', 'client'],
      reason: 'Data proxy creates different traces',
    },
  },
)
