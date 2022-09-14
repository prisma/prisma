import { context } from '@opentelemetry/api'
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { Resource } from '@opentelemetry/resources'
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { PrismaInstrumentation } from '@prisma/instrumentation'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

let inMemorySpanExporter: InMemorySpanExporter

beforeAll(() => {
  const contextManager = new AsyncHooksContextManager().enable()
  context.setGlobalContextManager(contextManager)

  inMemorySpanExporter = new InMemorySpanExporter()

  const basicTracerProvider = new BasicTracerProvider({
    sampler: new TraceIdRatioBasedSampler(0), // 0% sampling!!
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: `test-name`,
      [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
    }),
  })

  basicTracerProvider.addSpanProcessor(new SimpleSpanProcessor(inMemorySpanExporter))
  basicTracerProvider.register()

  registerInstrumentations({
    instrumentations: [new PrismaInstrumentation({ middleware: true })],
  })
})

afterAll(() => {
  context.disable()
})

testMatrix.setupTestSuite(() => {
  test('should perform a query and assert that no spans were generated', async () => {
    await prisma.user.findMany()

    const spans = inMemorySpanExporter.getFinishedSpans()

    expect(spans).toHaveLength(0)
  })
})
