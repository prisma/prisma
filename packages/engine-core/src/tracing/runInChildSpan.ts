import { Context, context as _context, Span, SpanOptions as _SpanOptions, trace } from '@opentelemetry/api'

const showAllTraces = process.env.PRISMA_SHOW_ALL_TRACES === 'true'

export type SpanOptions = _SpanOptions & {
  /** The name of the span */
  name: string
  /** Whether we trace it */
  enabled: boolean
  /* Internal spans are not shown unless PRISMA_SHOW_ALL_TRACES=true env var is set */
  internal?: boolean
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
export function runInChildSpan<R>(options: SpanOptions, cb: (span?: Span, context?: Context) => R): R {
  if (options.enabled === false || (options.internal && !showAllTraces)) {
    return cb()
  }

  const tracer = trace.getTracer('prisma')
  const context = options.context ?? _context.active()

  // these spans will not be nested by default even in recursive calls
  // it's useful for showing middleware sequentially instead of nested
  if (options.active === false) {
    const span = tracer.startSpan(`prisma:client:${options.name}`, options, context)
    const result = cb(span, context)
    return endSpan(span, result)
  }

  // by default spans are "active", which means context is propagated in
  // nested calls, which is useful for representing most of the calls
  return tracer.startActiveSpan(`prisma:client:${options.name}`, options, context, (span) => {
    const result = cb(span, _context.active())
    return endSpan(span, result)
  })
}

function endSpan<T>(span: Span, result: T): T {
  if (isPromiseLike(result)) {
    return result.then(
      (value) => {
        span.end()
        return value
      },
      (reason) => {
        span.end()
        throw reason
      },
    ) as T
  }
  span.end()
  return result
}

export function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return value != null && typeof value['then'] === 'function'
}
