import { ROOT_CONTEXT, SpanContext, SpanKind, trace, TraceFlags } from '@opentelemetry/api'
import { Span, Tracer } from '@opentelemetry/sdk-trace-base'

import { EngineSpanEvent } from '../common/types/QueryEngine'

export async function createSpan(engineSpanEvent: EngineSpanEvent) {
  // this is only needed for tests and isn't useful otherwise
  // so that "engine" spans are always emitted after "client"
  await new Promise((res) => setTimeout(res, 0))

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
      engineSpan.start_time,
    )

    if (engineSpan.attributes) {
      span.setAttributes(engineSpan.attributes)
    }

    span.end(engineSpan.end_time)
  })
}
