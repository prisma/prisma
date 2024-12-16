import type { Context, Span, SpanOptions } from '@opentelemetry/api'

export type SpanCallback<R> = (span?: Span, context?: Context) => R

export type ExtendedSpanOptions = SpanOptions & {
  /** The name of the span */
  name: string
  /* Internal spans are not shown unless PRISMA_SHOW_ALL_TRACES=true env var is set */
  internal?: boolean
  /* Middleware spans are not shown unless `middleware` options is set for PrismaInstrumentation constructor */
  middleware?: boolean
  /** Whether it propagates context (?=true) */
  active?: boolean
  /** The context to append the span to */
  context?: Context
}

export type EngineSpanId = string

export type HrTime = [number, number]

export type EngineSpanKind = 'client' | 'internal'

export type EngineSpan = {
  id: EngineSpanId
  parentId: string | null
  name: string
  startTime: HrTime
  endTime: HrTime
  kind: EngineSpanKind
  attributes?: Record<string, unknown>
  links?: EngineSpanId[]
}

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'query'

export type EngineTraceEvent = {
  spanId: EngineSpanId
  target: string
  level: LogLevel
  timestamp: HrTime
  attributes: Record<string, unknown> & {
    message?: string
    query?: string
    duration_ms?: number
    params?: string
  }
}

export type EngineTrace = {
  spans: EngineSpan[]
  events: EngineTraceEvent[]
}

export interface TracingHelper {
  isEnabled(): boolean
  getTraceParent(context?: Context): string
  dispatchEngineSpans(spans: EngineSpan[]): void

  getActiveContext(): Context | undefined

  runInChildSpan<R>(nameOrOptions: string | ExtendedSpanOptions, callback: SpanCallback<R>): R
}

export type PrismaInstrumentationGlobalValue = {
  helper?: TracingHelper
}

declare global {
  // eslint-disable-next-line no-var
  var PRISMA_INSTRUMENTATION: PrismaInstrumentationGlobalValue | undefined
}
