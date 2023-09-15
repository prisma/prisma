import {
  Context,
  context as _context,
  ROOT_CONTEXT,
  Span,
  SpanContext,
  SpanKind,
  trace,
  TraceFlags,
} from '@opentelemetry/api'
import { Tracer } from '@opentelemetry/sdk-trace-base'
import { EngineSpan, EngineSpanEvent, ExtendedSpanOptions, SpanCallback, TracingHelper } from '@prisma/internals'

// If true, will publish internal spans as well
const showAllTraces = process.env.PRISMA_SHOW_ALL_TRACES === 'true'

// https://www.w3.org/TR/trace-context/#examples-of-http-traceparent-headers
// If traceparent ends with -00 this trace will not be sampled
// the query engine needs the `10` for the span and trace id otherwise it does not parse this
const nonSampledTraceParent = `00-10-10-00`

type Options = {
  traceMiddleware: boolean
}

export class ActiveTracingHelper implements TracingHelper {
  private traceMiddleware: boolean
  private engineSpansToProcess = new Map<string, EngineSpan[]>()

  constructor({ traceMiddleware }: Options) {
    this.traceMiddleware = traceMiddleware
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

  createEngineSpan(engineSpanEvent: EngineSpanEvent) {
    const rootEngineSpans = ['prisma:engine', 'prisma:engine:itx_runner']

    for (const span of engineSpanEvent.spans) {
      // We receive engine spans as soon as they end. So the parent nodes are received after the children.
      // Because of that we cannot process the spans immediately, as creating spans affects them a random SpanId and that
      // breaks the `parent_span_id` relationship.
      // To circumvent this issue we accumulate engine spans and only process them once a full span tree is acquired.
      const currentValue = this.engineSpansToProcess.get(span.parent_span_id) ?? []
      this.engineSpansToProcess.set(span.parent_span_id, [...currentValue, span])

      if (rootEngineSpans.includes(span.name)) {
        this.processEngineSpanTreeRecursively(span, span.parent_span_id)
      }
    }
  }

  processEngineSpanTreeRecursively(engineSpan: EngineSpan, parentSpanId: string) {
    const tracer = trace.getTracer('prisma') as Tracer

    const links = engineSpan.links?.map((link) => {
      return {
        context: {
          traceId: link.trace_id,
          spanId: link.span_id,
          traceFlags: TraceFlags.SAMPLED,
        },
      }
    })

    const parentSpanContext: SpanContext = {
      traceId: engineSpan.trace_id,
      spanId: parentSpanId,
      traceFlags: TraceFlags.SAMPLED,
    }
    const parentContext = trace.setSpanContext(ROOT_CONTEXT, parentSpanContext)
    const span = tracer.startSpan(
      engineSpan.name,
      {
        links,
        kind: SpanKind.INTERNAL,
        startTime: engineSpan.start_time,
        attributes: engineSpan.attributes,
      },
      parentContext,
    )

    span.end(engineSpan.end_time)

    const childrenSpans = this.engineSpansToProcess.get(engineSpan.span_id) ?? []
    for (const childSpan of childrenSpans) {
      this.processEngineSpanTreeRecursively(childSpan, span.spanContext().spanId)
    }
    this.engineSpansToProcess.delete(engineSpan.span_id)
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

    const tracer = trace.getTracer('prisma')
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
