// EventEmitter represents a platform-agnostic slice of NodeJS.EventEmitter,
export interface EventEmitter {
  on(event: string, listener: (...args: any[]) => void): unknown
  emit(event: string, args?: any): boolean
}
