import {
  Attributes,
  Context,
  context as _context,
  Span,
  SpanKind,
  SpanOptions,
  trace,
  Tracer,
  TracerProvider,
} from '@opentelemetry/api'
import type {
  EngineSpan,
  EngineSpanId,
  EngineSpanKind,
  EngineTraceEvent,
  ExtendedSpanOptions,
  SpanCallback,
  TracingHelper,
} from '@prisma/instrumentation-contract'

// If true, will publish internal spans as well
const showAllTraces = process.env.PRISMA_SHOW_ALL_TRACES === 'true'

// https://www.w3.org/TR/trace-context/#examples-of-http-traceparent-headers
// If traceparent ends with -00 this trace will not be sampled
// the query engine needs the `10` for the span and trace id otherwise it does not parse this
const nonSampledTraceParent = `00-10-10-00`

type Options = {
  tracerProvider: TracerProvider
  ignoreSpanTypes: (string | RegExp)[]
}

function engineSpanKindToOtelSpanKind(engineSpanKind: EngineSpanKind): SpanKind {
  switch (engineSpanKind) {
    case 'client':
      return SpanKind.CLIENT
    case 'internal':
    default: // Other span kinds aren't currently supported
      return SpanKind.INTERNAL
  }
}

export class ActiveTracingHelper implements TracingHelper {
  private tracerProvider: TracerProvider
  private ignoreSpanTypes: (string | RegExp)[]

  constructor({ tracerProvider, ignoreSpanTypes }: Options) {
    this.tracerProvider = tracerProvider
    this.ignoreSpanTypes = ignoreSpanTypes
  }

  isEnabled(): boolean {
    return true
  }

  getTraceParent(context?: Context | undefined): string {
    const span = trace.getSpanContext(context ?? _context.active())
    if (span) {
      return `00-${span.traceId}-${span.spanId}-0${span.traceFlags}`
    }
    return nonSampledTraceParent
  }

  dispatchEngineSpans(
    spans: EngineSpan[],
    events: EngineTraceEvent[],
    emitLogEvent: (event: EngineTraceEvent) => void,
  ): void {
    const tracer = this.tracerProvider.getTracer('prisma')
    const linkIds = new Map<EngineSpanId, EngineSpanId>()
    const roots = spans.filter((span) => span.parentId === null)
    const eventsMap = createEventsMap(events)

    for (const root of roots) {
      dispatchEngineSpan(tracer, root, spans, linkIds, this.ignoreSpanTypes, eventsMap, emitLogEvent)
    }

    // Emit any remaining events that weren't consumed by `dispatchEngineSpan`
    // (for example, the parent span might've been ignored)
    for (const events of eventsMap.values()) {
      for (const event of events) {
        emitLogEvent(event)
      }
    }
  }

  getActiveContext(): Context | undefined {
    return _context.active()
  }

  runInChildSpan<R>(options: string | ExtendedSpanOptions, callback: SpanCallback<R>): R {
    if (typeof options === 'string') {
      options = { name: options }
    }

    if (options.internal && !showAllTraces) {
      return callback()
    }

    const tracer = this.tracerProvider.getTracer('prisma')
    const context = options.context ?? this.getActiveContext()
    const name = `prisma:client:${options.name}`

    if (shouldIgnoreSpan(name, this.ignoreSpanTypes)) {
      return callback()
    }

    // these spans will not be nested by default even in recursive calls
    // it used to be useful for showing middleware sequentially instead of nested
    if (options.active === false) {
      const span = tracer.startSpan(name, options, context)
      return endSpan(span, callback(span, context))
    }

    // by default spans are "active", which means context is propagated in
    // nested calls, which is useful for representing most of the calls
    return tracer.startActiveSpan(name, options, (span) => endSpan(span, callback(span, context)))
  }
}

function createEventsMap(events: EngineTraceEvent[]): Map<EngineSpanId, EngineTraceEvent[]> {
  const eventsMap = new Map<EngineSpanId, EngineTraceEvent[]>()

  for (const event of events) {
    let spanEvents = eventsMap.get(event.spanId)
    if (!spanEvents) {
      spanEvents = []
      eventsMap.set(event.spanId, spanEvents)
    }

    spanEvents.push(event)
  }

  return eventsMap
}

function dispatchEngineSpan(
  tracer: Tracer,
  engineSpan: EngineSpan,
  allSpans: EngineSpan[],
  linkIds: Map<string, string>,
  ignoreSpanTypes: (string | RegExp)[],
  events: Map<EngineSpanId, EngineTraceEvent[]>,
  emitLogEvent: (event: EngineTraceEvent) => void,
) {
  if (shouldIgnoreSpan(engineSpan.name, ignoreSpanTypes)) return

  const spanOptions = {
    attributes: engineSpan.attributes as Attributes,
    kind: engineSpanKindToOtelSpanKind(engineSpan.kind),
    startTime: engineSpan.startTime,
  } satisfies SpanOptions

  tracer.startActiveSpan(engineSpan.name, spanOptions, (span) => {
    linkIds.set(engineSpan.id, span.spanContext().spanId)

    if (engineSpan.links) {
      span.addLinks(
        engineSpan.links.flatMap((link) => {
          const linkedId = linkIds.get(link)
          if (!linkedId) {
            return []
          }
          return {
            context: {
              spanId: linkedId,
              traceId: span.spanContext().traceId,
              traceFlags: span.spanContext().traceFlags,
            },
          }
        }),
      )
    }

    const spanEvents = events.get(engineSpan.id)

    if (spanEvents !== undefined) {
      events.delete(engineSpan.id)

      for (const event of spanEvents) {
        emitLogEvent(event)
        span.addEvent(event.level, event.attributes as Attributes, event.timestamp)

        if (event.level === 'error') {
          span.recordException({ message: event.attributes.message ?? '' }, event.timestamp)
        }
      }
    }

    const children = allSpans.filter((s) => s.parentId === engineSpan.id)
    for (const child of children) {
      dispatchEngineSpan(tracer, child, allSpans, linkIds, ignoreSpanTypes, events, emitLogEvent)
    }

    span.end(engineSpan.endTime)
  })
}

function endSpan<T>(span: Span, result: T): T {
  if (isPromiseLike(result)) {
    return result.then(
      (value) => {
        span.end()
        return value
      },
      (reason) => {
        span.end()
        throw reason
      },
    ) as T
  }
  span.end()
  return result
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return value != null && typeof value['then'] === 'function'
}

function shouldIgnoreSpan(spanName: string, ignoreSpanTypes: (string | RegExp)[]): boolean {
  return ignoreSpanTypes.some((pattern) =>
    typeof pattern === 'string' ? pattern === spanName : pattern.test(spanName),
  )
}
