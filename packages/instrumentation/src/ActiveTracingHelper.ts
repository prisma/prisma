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
import { Span as SpanConstructor, Tracer } from '@opentelemetry/sdk-trace-base'
import { EngineSpanEvent, ExtendedSpanOptions, SpanCallback, TracingHelper } from '@prisma/internals'

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

  async createEngineSpan(engineSpanEvent: EngineSpanEvent): Promise<void> {
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

      const span = new SpanConstructor(
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
