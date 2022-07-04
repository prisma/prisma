import { Attributes, context, HrTime, SpanKind, SpanOptions, trace, TraceFlags } from '@opentelemetry/api'
import { Span } from '@opentelemetry/sdk-trace-base'

/**
 * Executes and traces a function inside of a child span.
 * @param name of the child span
 * @param callback to trace in the child span
 * @param options span options
 * @returns
 */
export async function runInChildSpan<R>({
  name,
  callback,
  options = {},
}: {
  name: string
  callback: () => Promise<R>
  options?: SpanOptions
}) {
  const tracer = trace.getTracer('prisma')

  return tracer.startActiveSpan(name, options, context.active(), async (span) => {
    return callback().finally(() => span.end())
  })
}

export type EngineSpanEvent = {
  span: boolean
  spans: EngineSpan[]
}

export type EngineSpan = {
  span: boolean
  name: string
  trace_id: string
  span_id: string
  parent_span_id: string
  start_time: string
  end_time: string
  attributes?: Attributes
}

export function createSpan(engineSpanEvent: EngineSpanEvent) {
  engineSpanEvent.spans.forEach((engineSpan) => {
    const startTime = numberToHrtime(parseInt(engineSpan.start_time, 10))
    const endTime = numberToHrtime(parseInt(engineSpan.end_time, 10))

    const spanContext = {
      traceId: engineSpan.trace_id,
      traceState: TraceFlags.SAMPLED,
      parentSpanId: engineSpan.parent_span_id,
      spanId: engineSpan.span_id,
      traceFlags: TraceFlags.SAMPLED,
      attributes: [],
      // traceState,
    }
    const links = []
    const tracer = trace.getTracer('prisma')

    const span = new Span(
      //@ts-ignore
      tracer,
      context,
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
