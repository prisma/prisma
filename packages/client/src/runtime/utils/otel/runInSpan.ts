import { context, SpanOptions, trace } from '@opentelemetry/api'

export function runInActiveSpan<R>({
  name,
  callback,
  options = {},
}: {
  name: string
  callback: () => Promise<R>
  options?: SpanOptions
}) {
  const tracer = trace.getTracer('prisma')

  return tracer.startActiveSpan(name, options, context.active(), async (span) => {
    return callback().finally(() => span.end())
  })
}

export async function runInSpan<R>({
  name,
  callback,
  options = {},
}: {
  name: string
  callback: () => Promise<R>
  options?: SpanOptions
}): Promise<R> {
  const tracer = trace.getTracer('prisma')
  const span = tracer.startSpan(name, options)

  try {
    return await callback()
  } finally {
    span.end()
  }
}
