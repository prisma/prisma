import { context, trace } from '@opentelemetry/api'

export function getTraceParent(): string | undefined {
  const span = trace.getSpanContext(context.active())

  if (span?.traceFlags === 1 /** if we are tracing */) {
    return `00-${span.traceId}-${span.spanId}-01`
  }

  return undefined
}
