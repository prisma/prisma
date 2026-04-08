import type { Context } from '@opentelemetry/api'
import {
  EngineSpan,
  ExtendedSpanOptions,
  getGlobalTracingHelper,
  SpanCallback,
  TracingHelper,
} from '@prisma/instrumentation-contract'

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
    return this.getTracingHelper().isEnabled()
  }
  getTraceParent(context: Context) {
    return this.getTracingHelper().getTraceParent(context)
  }

  dispatchEngineSpans(spans: EngineSpan[]) {
    return this.getTracingHelper().dispatchEngineSpans(spans)
  }

  getActiveContext() {
    return this.getTracingHelper().getActiveContext()
  }
  runInChildSpan<R>(options: string | ExtendedSpanOptions, callback: SpanCallback<R>): R {
    return this.getTracingHelper().runInChildSpan(options, callback)
  }

  private getTracingHelper(): TracingHelper {
    return getGlobalTracingHelper() ?? disabledTracingHelper
  }
}

export function getTracingHelper(): TracingHelper {
  return new DynamicTracingHelper()
}
