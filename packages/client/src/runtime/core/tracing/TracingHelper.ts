import type { Context } from '@opentelemetry/api'
import { EngineSpan, ExtendedSpanOptions, SpanCallback, TracingHelper } from '@prisma/internals'

export const disabledTracingHelper: TracingHelper = {
  isEnabled() {
    return false
  },
  getTraceParent() {
    // https://www.w3.org/TR/trace-context/#examples-of-http-traceparent-headers
    // If traceparent ends with -00 this trace will not be sampled
    // the query engine needs the `10` for the span and trace id otherwise it does not parse this
    return `00-10-10-00`
  },

  dispatchEngineSpans() {},

  getActiveContext() {
    return undefined
  },

  runInChildSpan<R>(options: string | ExtendedSpanOptions, callback: SpanCallback<R>): R {
    return callback()
  },
}

/**
 * Tracing helper that can dynamically switch between enabled/disabled states
 * Needed because tracing can be disabled and enabled with the calls to
 * PrismaInstrumentation::disable/enable at any point
 */
class DynamicTracingHelper implements TracingHelper {
  isEnabled(): boolean {
    return this.getGlobalTracingHelper().isEnabled()
  }
  getTraceParent(context: Context) {
    return this.getGlobalTracingHelper().getTraceParent(context)
  }

  dispatchEngineSpans(spans: EngineSpan[]) {
    return this.getGlobalTracingHelper().dispatchEngineSpans(spans)
  }

  getActiveContext() {
    return this.getGlobalTracingHelper().getActiveContext()
  }
  runInChildSpan<R>(options: string | ExtendedSpanOptions, callback: SpanCallback<R>): R {
    return this.getGlobalTracingHelper().runInChildSpan(options, callback)
  }

  private getGlobalTracingHelper(): TracingHelper {
    return globalThis.PRISMA_INSTRUMENTATION?.helper ?? disabledTracingHelper
  }
}

export function getTracingHelper(): TracingHelper {
  return new DynamicTracingHelper()
}
