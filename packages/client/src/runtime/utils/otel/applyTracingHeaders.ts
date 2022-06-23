import { context, trace } from '@opentelemetry/api'

/**
 * Adds the open telemetry span context to the Engine headers.
 * @param headers to add traceparent to
 */
export function applyTracingHeaders(headers: Record<string, string> | undefined) {
  const span = trace.getSpanContext(context.active())

  if (span?.traceFlags === 1 /** if we are tracing */) {
    return {
      traceparent: `00-${span.traceId}-${span.spanId}-01`,
      ...headers,
    }
  }

  return headers ?? {}
}
