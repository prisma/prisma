import { Context, context as otelContext, Span, SpanContext, SpanKind, trace, TraceFlags } from '@opentelemetry/api'
import { type Tracer } from '@opentelemetry/sdk-trace-base'
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
    const span = trace.getSpanContext(context ?? otelContext.active())
    if (span) {
      return `00-${span.traceId}-${span.spanId}-0${span.traceFlags}`
    }
    return nonSampledTraceParent
  }

  createEngineSpan(engineSpanEvent: EngineSpanEvent) {
    const tracer = trace.getTracer('prisma') as Tracer

    engineSpanEvent.spans.forEach((engineSpan) => {
      const parentSpanContext: SpanContext = {
        spanId: engineSpan.parent_span_id,
        traceId: engineSpan.trace_id,
        traceFlags: TraceFlags.SAMPLED,
        traceState: undefined,
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

      /**
       * Create a new span with the given `options` and `context`.
       * `context` is used internally to find the parent of the span to create.
       *
       * On new child spans, `context.spanId` is used as the `parentSpanId` for the new span.
       * See: https://github.com/open-telemetry/opentelemetry-js/blob/b78fec34060f15499c1756fd966f745262e148d9/packages/opentelemetry-sdk-trace-base/src/Tracer.ts#L84-L100.
       *
       * However, we need `context.spanId` to be the `spanId` of the new span!
       * The trick to obtain so is to modify the `spanId` of the new span's context immediately after creating the span.
       *
       * Before using this public API, we used to instantiate a new `Span` object directly, abusing the private API
       * and missing out on the logic that `tracer.startActiveSpan` / `tracer.startSpan` provide (e.g.: sampling setup).
       */
      tracer.startActiveSpan(
        engineSpan.name,
        /* options */
        {
          kind: SpanKind.INTERNAL,
          links,
          startTime: engineSpan.start_time,
          attributes: engineSpan.attributes,
        },
        /* context */
        trace.setSpanContext(otelContext.active(), parentSpanContext),
        (span) => {
          /**
           * The span is already created and has `engineSpan.parent_span_id` as a `parentId`, so we
           * reset the `spanId` saved in its context to `engineSpan.span_id`.
           * Note: `span.spanContext()` isn't guaranteed to be mutable in the future.
           * */
          const currentSpanContext = span.spanContext()
          currentSpanContext.spanId = engineSpan.span_id

          span.end(engineSpan.end_time)
        },
      )
    })
  }

  getActiveContext(): Context | undefined {
    return otelContext.active()
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
