import { Context, context, trace } from '@opentelemetry/api'

/**
 * Adds the open telemetry span context to the Engine headers.
 * @param context an otel context
 */
export function getTraceParent(otelCtx?: Context) {
  const span = trace.getSpanContext(otelCtx ?? context.active())!

  return `00-${span.traceId}-${span.spanId}-01`
}
