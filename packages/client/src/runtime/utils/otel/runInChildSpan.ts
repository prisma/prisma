import { context, SpanOptions, trace } from '@opentelemetry/api'

export function runInChildSpan<R>({
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
