import { Context, context as _context, trace } from '@opentelemetry/api'

/**
 * Gets the traceparent for a given context. It will infer it from the current
 * context if no parameter is provided.
 * @param context an otel context
 */
export function getTraceParent(context?: Context) {
  const span = trace.getSpanContext(context ?? _context.active())

  if (span?.traceFlags === 1 /** if we are tracing */) {
    return `00-${span.traceId}-${span.spanId}-01`
  }

  return undefined
}
