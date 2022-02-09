import type { Context } from '@opentelemetry/api'
import { trace } from '@opentelemetry/api'

/**
 * Adds the open telemetry span context to the Engine headers.
 * @param headers to add traceparent to
 * @param otelCtx to get the active span
 */
export function applyTracingHeaders(headers: Record<string, string> | undefined, otelCtx: Context | undefined) {
  const span = otelCtx && trace.getSpanContext(otelCtx)

  if (span?.traceFlags === 1 /** if we are tracing */) {
    return {
      traceparent: `00-${span.traceId}-${span.spanId}-01`,
      ...headers,
    }
  }

  return headers ?? {}
}
