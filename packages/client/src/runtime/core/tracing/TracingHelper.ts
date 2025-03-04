import type { Context } from '@opentelemetry/api'
import {
  type EngineSpan,
  type ExtendedSpanOptions,
  type SpanCallback,
  type TracingHelper,
  version,
} from '@prisma/internals'

const majorVersion = version.split('.')[0]

export const disabledTracingHelper: TracingHelper = {
  isEnabled() {
    return false
  },
  getTraceParent() {
    // https://www.w3.org/TR/trace-context/#examples-of-http-traceparent-headers
    // If traceparent ends with -00 this trace will not be sampled
    // the query engine needs the `10` for the span and trace id otherwise it does not parse this
    return '00-10-10-00'
  },

  dispatchEngineSpans() {},

  getActiveContext() {
    return undefined
  },

  runInChildSpan<R>(_options: string | ExtendedSpanOptions, callback: SpanCallback<R>): R {
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
    // These globals are defined in `@prisma/instrumentation`
    const versionedPrismaInstrumentationGlobal = globalThis[`V${majorVersion}_PRISMA_INSTRUMENTATION`]
    const fallbackPrismaInstrumentationGlobal = globalThis.PRISMA_INSTRUMENTATION

    return (
      versionedPrismaInstrumentationGlobal?.helper ??
      // TODO(v7): In future major versions, the tracing helper should only be read from the versioned global field.
      // This is to ensure that instrumentation libraries (including `@prisma/instrumentation`) can register tracing helpers with compatible interfaces for each major version - thus preventing potential crashes in case instrumentation libraries are not yet updated for a new major, allowing for easier migration.
      // Currently, the versioned helper is preferred and the fallback helper is picked up for backwards compatibility.
      fallbackPrismaInstrumentationGlobal?.helper ??
      disabledTracingHelper
    )
  }
}

export function getTracingHelper(): TracingHelper {
  return new DynamicTracingHelper()
}
