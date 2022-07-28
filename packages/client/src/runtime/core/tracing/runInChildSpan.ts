import { Context, context, Span, SpanOptions as _SpanOptions, trace } from '@opentelemetry/api'

export type SpanOptions = _SpanOptions & { name: string; enabled: boolean; otelCtx?: Context }

/**
 * Executes and traces a function inside of a child span asynchronously.
 * @param options the options for the child span.
 * @returns
 */
export async function runInChildSpan<R>(options: SpanOptions, cb: (span?: Span, context?: Context) => Promise<R>) {
  if (options.enabled === false) return cb()

  const tracer = trace.getTracer('prisma')

  return tracer.startActiveSpan(
    `prisma:${options.name}`,
    options,
    options.otelCtx ?? context.active(),
    async (span) => {
      return cb(span, context.active()).finally(() => span.end())
    },
  )
}
