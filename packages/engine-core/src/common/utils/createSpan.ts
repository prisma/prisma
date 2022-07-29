import { ROOT_CONTEXT, SpanContext, SpanKind, trace, TraceFlags } from '@opentelemetry/api'
import { Span, Tracer } from '@opentelemetry/sdk-trace-base'

import { EngineSpanEvent } from '../types/QueryEngine'

export function createSpan(engineSpanEvent: EngineSpanEvent) {
  const tracer = trace.getTracer('prisma') as Tracer

  engineSpanEvent.spans.forEach((engineSpan) => {
    const spanContext: SpanContext = {
      traceId: engineSpan.trace_id,
      spanId: engineSpan.span_id,
      traceFlags: TraceFlags.SAMPLED,
    }

    const links = engineSpan.links?.map((link) => {
      return {
        context: {
          traceId: link.trace_id,
          spanId: link.span_id,
          traceFlags: TraceFlags.SAMPLED,
        },
      }
    })

    const span = new Span(
      tracer,
      ROOT_CONTEXT,
      engineSpan.name,
      spanContext,
      SpanKind.INTERNAL,
      engineSpan.parent_span_id,
      links,
      parseInt(engineSpan.start_time),
    )

    if (engineSpan.attributes) {
      span.setAttributes(engineSpan.attributes)
    }

    span.end(parseInt(engineSpan.end_time))
  })
}
