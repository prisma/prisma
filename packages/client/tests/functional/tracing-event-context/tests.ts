import { faker } from '@faker-js/faker'
import { context, SpanContext, trace } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  SpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import { PrismaInstrumentation } from '@prisma/instrumentation'

import { Providers } from '../_utils/providers'
import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

// @only-ts-generator
type LogPrismaClient = PrismaClient<'query'>
// @only-js-generator
type LogPrismaClient = PrismaClient<{ log: [{ emit: 'event'; level: 'query' }] }>

declare const newPrismaClient: NewPrismaClient<LogPrismaClient, typeof PrismaClient>

let inMemorySpanExporter: InMemorySpanExporter
let processor: SpanProcessor

beforeAll(() => {
  const contextManager = new AsyncLocalStorageContextManager().enable()
  context.setGlobalContextManager(contextManager)

  inMemorySpanExporter = new InMemorySpanExporter()
  processor = new SimpleSpanProcessor(inMemorySpanExporter)

  const basicTracerProvider = new BasicTracerProvider({
    spanProcessors: [processor],
  })

  trace.setGlobalTracerProvider(basicTracerProvider)

  registerInstrumentations({
    instrumentations: [new PrismaInstrumentation()],
  })
})

afterAll(() => {
  context.disable()
})

testMatrix.setupTestSuite(
  ({ provider, driverAdapter }) => {
    const isMongoDb = provider === Providers.MONGODB

    beforeEach(() => {
      inMemorySpanExporter.reset()
    })

    test('should have access to current span in query event handler', async () => {
      const client = newPrismaClient({
        log: [{ emit: 'event', level: 'query' }],
      })

      const capturedSpanContexts: SpanContext[] = []

      client.$on('query', () => {
        const span = trace.getActiveSpan()
        if (span) {
          capturedSpanContexts.push(span.spanContext())
        }
      })

      await client.user.findMany()
      await processor.forceFlush()

      // At least one query event should have been emitted with an active span
      expect(capturedSpanContexts.length).toBeGreaterThan(0)

      // Match captured span contexts with finished spans and verify they are db_query spans
      const finishedSpans = inMemorySpanExporter.getFinishedSpans()
      for (const capturedContext of capturedSpanContexts) {
        const matchingSpan = finishedSpans.find(
          (s) =>
            s.spanContext().traceId === capturedContext.traceId && s.spanContext().spanId === capturedContext.spanId,
        )
        expect(matchingSpan).toBeDefined()
        expect(matchingSpan!.name).toMatch(/db_query/)
      }

      await client.$disconnect()
    })

    test('should have access to current span in query event handler during batch transaction', async () => {
      const client = newPrismaClient({
        log: [{ emit: 'event', level: 'query' }],
      })

      const capturedSpanContexts: SpanContext[] = []

      client.$on('query', () => {
        const span = trace.getActiveSpan()
        if (span) {
          capturedSpanContexts.push(span.spanContext())
        }
      })

      const id = isMongoDb ? faker.database.mongodbObjectId() : faker.string.uuid()

      await client.$transaction([
        client.user.findMany({
          where: { id },
        }),
      ])
      await processor.forceFlush()

      expect(capturedSpanContexts.length).toBeGreaterThan(0)

      const finishedSpans = inMemorySpanExporter.getFinishedSpans()
      for (const capturedContext of capturedSpanContexts) {
        const matchingSpan = finishedSpans.find(
          (s) =>
            s.spanContext().traceId === capturedContext.traceId && s.spanContext().spanId === capturedContext.spanId,
        )
        expect(matchingSpan).toBeDefined()
        expect(matchingSpan!.name).toMatch(/db_query/)
      }

      await client.$disconnect()
    })

    // D1: interactive transactions are not available
    skipTestIf(driverAdapter === 'js_d1')(
      'should have access to current span in query event handler during interactive transaction',
      async () => {
        const client = newPrismaClient({
          log: [{ emit: 'event', level: 'query' }],
        })

        const capturedSpanContexts: SpanContext[] = []

        client.$on('query', () => {
          const span = trace.getActiveSpan()
          if (span) {
            capturedSpanContexts.push(span.spanContext())
          }
        })

        const email = faker.internet.email()

        await client.$transaction(async (tx) => {
          await tx.user.create({
            data: { email },
          })
          return tx.user.findMany({
            where: { email },
          })
        })
        await processor.forceFlush()

        expect(capturedSpanContexts.length).toBeGreaterThan(0)

        const finishedSpans = inMemorySpanExporter.getFinishedSpans()
        for (const capturedContext of capturedSpanContexts) {
          const matchingSpan = finishedSpans.find(
            (s) =>
              s.spanContext().traceId === capturedContext.traceId && s.spanContext().spanId === capturedContext.spanId,
          )
          expect(matchingSpan).toBeDefined()
          expect(matchingSpan!.name).toMatch(/db_query/)
        }

        await client.$disconnect()
      },
    )

    test('all query events within a single operation should share the same trace', async () => {
      const client = newPrismaClient({
        log: [{ emit: 'event', level: 'query' }],
      })

      await client.user.create({
        data: {
          email: faker.internet.email(),
          posts: {
            create: [{ title: 'Post 1' }, { title: 'Post 2' }],
          },
        },
      })

      const capturedTraceIds: string[] = []

      client.$on('query', () => {
        const span = trace.getActiveSpan()
        if (span) {
          capturedTraceIds.push(span.spanContext().traceId)
        }
      })

      await client.user.findMany({
        include: { posts: true },
      })

      // Ensure we captured more than one query event
      expect(capturedTraceIds.length).toBeGreaterThan(1)

      // All query events from the same operation should belong to the same trace
      const uniqueTraceIds = new Set(capturedTraceIds)
      expect(uniqueTraceIds.size).toBe(1)

      await client.$disconnect()
    })
  },
  {
    skipDefaultClientInstance: true,
  },
)
