export type QueryEventType = 'query'

export type LogEventType = 'info' | 'warn' | 'error'

export type EngineEventType = QueryEventType | LogEventType

export type EngineEvent<E extends EngineEventType> = E extends QueryEventType ? QueryEvent : LogEvent

type EngineEventContravariant<E extends EngineEventType> = [E & QueryEventType] extends [never]
  ? LogEvent
  : [E & LogEventType] extends [never]
  ? QueryEvent
  : QueryEvent & LogEvent

export type QueryEvent = {
  timestamp: Date
  query: string
  params: string
  duration: number
  target: string
}

export type LogEvent = {
  timestamp: Date
  message: string
  target: string
}

export type LogEmitter = {
  on<E extends EngineEventType>(event: E, listener: (event: EngineEvent<E>) => void): LogEmitter
  emit<E extends EngineEventType>(event: E, payload: EngineEventContravariant<E>): boolean
}
