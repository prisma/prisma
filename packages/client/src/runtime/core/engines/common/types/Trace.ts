export type SpanId = string

export type HrTime = [number, number]

export type SpanKind = 'internal' | 'client'

export type Span = {
  id: SpanId
  parentId: string | null
  name: string
  startTime: HrTime
  endTime: HrTime
  kind: SpanKind
  attributes?: Record<string, unknown>
  links?: SpanId[]
}

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'query'

export type Event = {
  spanId: SpanId
  name: string
  level: LogLevel
  timestamp: HrTime
  attributes: Record<string, unknown>
}

export type Trace = {
  spans: Span[]
  events: Event[]
}
