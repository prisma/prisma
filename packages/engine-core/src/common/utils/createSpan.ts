import { HrTime, ROOT_CONTEXT, SpanContext, SpanKind, trace, TraceFlags } from '@opentelemetry/api'
import { Span, Tracer } from '@opentelemetry/sdk-trace-base'

import { EngineSpanEvent } from '../types/QueryEngine'

export function createSpan(engineSpanEvent: EngineSpanEvent) {
  engineSpanEvent.spans.forEach((engineSpan) => {
    const startTime = numberToHrtime(parseInt(engineSpan.start_time, 10))
    const endTime = numberToHrtime(parseInt(engineSpan.end_time, 10))

    const spanContext: SpanContext = {
      traceId: engineSpan.trace_id,
      spanId: engineSpan.span_id,
      traceFlags: TraceFlags.SAMPLED,
    }

    const links = []
    const tracer = trace.getTracer('prisma') as Tracer

    const span = new Span(
      tracer,
      ROOT_CONTEXT,
      engineSpan.name,
      spanContext,
      SpanKind.INTERNAL,
      engineSpan.parent_span_id,
      links,
      startTime,
    )

    if (engineSpan.attributes) {
      span.setAttributes(engineSpan.attributes)
    }

    span.end(endTime)
  })
}

// Taken from https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-core/src/common/time.ts
const NANOSECOND_DIGITS = 9
const SECOND_TO_NANOSECONDS = Math.pow(10, NANOSECOND_DIGITS)
/**
 * Converts a number to HrTime, HrTime = [number, number].
 * The first number is UNIX Epoch time in seconds since 00:00:00 UTC on 1 January 1970.
 * The second number represents the partial second elapsed since Unix Epoch time represented by first number in nanoseconds.
 * For example, 2021-01-01T12:30:10.150Z in UNIX Epoch time in milliseconds is represented as 1609504210150.
 * numberToHrtime calculates the first number by converting and truncating the Epoch time in milliseconds to seconds:
 * HrTime[0] = Math.trunc(1609504210150 / 1000) = 1609504210.
 * numberToHrtime calculates the second number by converting the digits after the decimal point of the subtraction, (1609504210150 / 1000) - HrTime[0], to nanoseconds:
 * HrTime[1] = Number((1609504210.150 - HrTime[0]).toFixed(9)) * SECOND_TO_NANOSECONDS = 150000000.
 * This is represented in HrTime format as [1609504210, 150000000].
 * @param epochMillis
 */
function numberToHrtime(epochMillis: number): HrTime {
  const epochSeconds = epochMillis / 1000
  // Decimals only.
  const seconds = Math.trunc(epochSeconds)
  // Round sub-nanosecond accuracy to nanosecond.
  const nanos = Number((epochSeconds - seconds).toFixed(NANOSECOND_DIGITS)) * SECOND_TO_NANOSECONDS
  return [seconds, nanos]
}
