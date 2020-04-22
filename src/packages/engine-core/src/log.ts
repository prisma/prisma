export type LogLevel = 'info' | 'trace' | 'debug' | 'warn' | 'error' | 'query'

// export interface RustLog {
//   msg: string
//   level: LogLevel
//   ts: string
//   application: string
// }
export interface RawRustLog {
  timestamp: string
  level: LogLevel
  target: string
  fields: LogFields
}

export interface RustLog {
  timestamp: Date
  level: LogLevel
  target: string
  fields: LogFields
}

export interface RustError {
  is_panic: boolean
  message: string
  backtrace: string
}

export function isRustError(e: any): e is RustError {
  return typeof e.is_panic !== 'undefined'
}

export type LogFields = { [key: string]: any }

export interface PanicLogFields {
  message: 'PANIC'
  reason: string
  file: string
  line: string
  column: number
}

export interface InfoLogFields {
  message: string
  'log.target': string
  'log.module_path': string
  'log.file': string
  'log.line': number
}

export interface QueryLogFields {
  query: string
  item_type: string
  params: string
  duration_ms: number
}

export interface Log {
  message: string
  level: LogLevel
  date: Date
  application: string
  [key: string]: string | Date
}

export function convertLog(rustLog: RawRustLog): RustLog {
  const isQuery = isQueryLog(rustLog.fields)
  const level: LogLevel = isQuery
    ? 'query'
    : (rustLog.level.toLowerCase() as LogLevel)
  return {
    ...rustLog,
    level,
    timestamp: new Date(new Date().getFullYear() + ' ' + rustLog.timestamp),
  }
}

function isQueryLog(fields: any): fields is QueryLogFields {
  return Boolean(fields.query)
}
