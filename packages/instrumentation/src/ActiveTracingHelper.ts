import {
  type Attributes,
  type Context,
  context as _context,
  type Span,
  SpanKind,
  type SpanOptions,
  trace,
  type Tracer,
  type TracerProvider,
} from '@opentelemetry/api'
import type { EngineSpan, EngineSpanKind, ExtendedSpanOptions, SpanCallback, TracingHelper } from '@prisma/internals'

// If true, will publish internal spans as well
const showAllTraces = process.env.PRISMA_SHOW_ALL_TRACES === 'true'

// https://www.w3.org/TR/trace-context/#examples-of-http-traceparent-headers
// If traceparent ends with -00 this trace will not be sampled
// the query engine needs the `10` for the span and trace id otherwise it does not parse this
const nonSampledTraceParent = '00-10-10-00'

type Options = {
  traceMiddleware: boolean
  tracerProvider: TracerProvider
}

function engineSpanKindToOtelSpanKind(engineSpanKind: EngineSpanKind): SpanKind {
  switch (engineSpanKind) {
    case 'client':
      return SpanKind.CLIENT
    default: // Other span kinds aren't currently supported
      return SpanKind.INTERNAL
  }
}

export class ActiveTracingHelper implements TracingHelper {
  traceMiddleware: boolean
  tracerProvider: TracerProvider

  constructor({ traceMiddleware, tracerProvider }: Options) {
    this.traceMiddleware = traceMiddleware
    this.tracerProvider = tracerProvider
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

  dispatchEngineSpans(spans: EngineSpan[]): void {
    const tracer = this.tracerProvider.getTracer('prisma')
    const linkIds = new Map<string, string>()
    const roots = spans.filter((span) => span.parentId === null)

    for (const root of roots) {
      dispatchEngineSpan(tracer, root, spans, linkIds)
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

    if (options.middleware && !this.traceMiddleware) {
      return callback()
    }

    const tracer = this.tracerProvider.getTracer('prisma')
    const context = options.context ?? this.getActiveContext()
    const name = `prisma:client:${options.name}`
    // these spans will not be nested by default even in recursive calls
    // it's useful for showing middleware sequentially instead of nested
    if (options.active === false) {
      const span = tracer.startSpan(name, options, context)
      return endSpan(span, callback(span, context))
    }

    // by default spans are "active", which means context is propagated in
    // nested calls, which is useful for representing most of the calls
    return tracer.startActiveSpan(name, options, (span) => endSpan(span, callback(span, context)))
  }
}

function dispatchEngineSpan(
  tracer: Tracer,
  engineSpan: EngineSpan,
  allSpans: EngineSpan[],
  linkIds: Map<string, string>,
) {
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

    const children = allSpans.filter((s) => s.parentId === engineSpan.id)
    for (const child of children) {
      dispatchEngineSpan(tracer, child, allSpans, linkIds)
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
  return value != null && typeof value.then === 'function'
}
