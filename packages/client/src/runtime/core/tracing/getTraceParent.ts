import { Context, context as _context, trace } from '@opentelemetry/api'

/**
 * Adds the open telemetry span context to the Engine headers.
 * @param context an otel context
 */
export function getTraceParent(context?: Context) {
  const span = trace.getSpanContext(context ?? _context.active())!

  return `00-${span.traceId}-${span.spanId}-01`
}
