import type { Span, Tracer } from '@opentelemetry/api'
import { context, trace } from '@opentelemetry/api'

export function getChildSpan(name: string, tracer: Tracer | undefined, parent: Span | undefined) {
  const ctx = parent && trace.setSpan(context.active(), parent)

  return tracer?.startSpan(name, undefined, ctx)
}
