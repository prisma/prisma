export type EngineEventType = 'query' | 'info' | 'warn' | 'error'

export type EngineEvent<E extends EngineEventType> = E extends 'query' ? QueryEvent : LogEvent

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
  emit<E extends EngineEventType>(event: E, payload: EngineEvent<E>): boolean
}
