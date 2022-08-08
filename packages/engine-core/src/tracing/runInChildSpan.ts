import { Context, context as _context, Span, SpanOptions as _SpanOptions, trace } from '@opentelemetry/api'

export type SpanOptions = _SpanOptions & {
  /** The name of the span */
  name: string
  /** Whether we trace it */
  enabled: boolean
  /** Whether it propagates context (?=true) */
  active?: boolean
  /** The context to append the span to */
  context?: Context
}

/**
 * Executes and traces a function inside of a child span asynchronously.
 * @param options the options for the child span.
 * @returns
 */
export async function runInChildSpan<R>(options: SpanOptions, cb: (span?: Span, context?: Context) => R | Promise<R>) {
  if (options.enabled === false) return cb()

  const tracer = trace.getTracer('prisma')
  const context = options.context ?? _context.active()

  // these spans will not be nested by default even in recursive calls
  // it's useful for showing middleware sequentially instead of nested
  if (options.active === false) {
    const span = tracer.startSpan(`prisma:client:${options.name}`, options, context)

    try {
      return await cb(span, context)
    } finally {
      span.end()
    }
  }

  // by default spans are "active", which means context is propagated in
  // nested calls, which is useful for representing most of the calls
  return tracer.startActiveSpan(`prisma:client:${options.name}`, options, context, async (span) => {
    try {
      return await cb(span, _context.active())
    } finally {
      span.end()
    }
  })
}
