import { context } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { Resource } from '@opentelemetry/resources'
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

let inMemorySpanExporter: InMemorySpanExporter

beforeAll(() => {
  const contextManager = new AsyncLocalStorageContextManager().enable()
  context.setGlobalContextManager(contextManager)

  inMemorySpanExporter = new InMemorySpanExporter()

  const basicTracerProvider = new BasicTracerProvider({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: 'test-name',
      [SEMRESATTRS_SERVICE_VERSION]: '1.0.0',
    }),
  })

  basicTracerProvider.addSpanProcessor(new SimpleSpanProcessor(inMemorySpanExporter))
  basicTracerProvider.register()

  /* new PrismaInstrumentation is not enabled so spans should not be generated */
  // registerInstrumentations({
  //   instrumentations: [new PrismaInstrumentation()],
  // })
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
