// this code will be copied into workbench directory, so prisma packages paths are relative to it

import { context } from '@opentelemetry/api'

// @ts-ignore Does not exist during build, but will exist during the execution
import { PrismaInstrumentation } from './node_modules/@prisma/instrumentation/dist/index.js'
import { BenchmarkSpanExporter, setupOtel } from './otel'

const exporter = new BenchmarkSpanExporter()

setupOtel(exporter, new PrismaInstrumentation())
const { trace } = require('@opentelemetry/api')

const tracer = trace.getTracer('benchmark')
const fullSpan = tracer.startSpan('benchmark:total')
const ctx = trace.setSpan(context.active(), fullSpan)

const requireSpan = tracer.startSpan('benchmark:requireClient', undefined, ctx)

const { PrismaClient } = require('./prisma/client')

requireSpan.end()

const prisma = context.with(ctx, () =>
  tracer.startActiveSpan('benchmark:clientConstructor', (span) => {
    const client = new PrismaClient()
    span.end()
    return client
  }),
)
await context.with(ctx, () => prisma.$connect())

export async function runMeasurement() {
  await context.with(ctx, async () => {
    try {
      await prisma.user.findMany({})
    } finally {
      fullSpan.end()
      await prisma?.$disconnect()
    }
  })

  const results = exporter.results
  const memory = process.memoryUsage()
  results['heap'] = memory.heapUsed
  results['rss'] = memory.rss
  return results
}
