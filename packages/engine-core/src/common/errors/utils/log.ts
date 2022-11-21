export type LogLevel = 'info' | 'trace' | 'debug' | 'warn' | 'error' | 'query'
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

// TODO #debt check if this is up to date
export interface RustError {
  is_panic: boolean
  message: string
  backtrace?: string
}

export function getMessage(log: string | RustLog | RustError | any): string {
  if (typeof log === 'string') {
    return log
  } else if (isRustError(log)) {
    return getBacktraceFromRustError(log)
  } else if (isRustLog(log)) {
    return getBacktraceFromLog(log)
  }

  return JSON.stringify(log)
}

export function getBacktrace(err: RustError | RustLog): string {
  if (isRustError(err)) {
    return getBacktraceFromRustError(err)
  }
  return getBacktraceFromLog(err)
}

function getBacktraceFromLog(log: RustLog): string {
  if (log.fields?.message) {
    let str = log.fields?.message
    if (log.fields?.file) {
      str += ` in ${log.fields.file}`
      if (log.fields?.line) {
        str += `:${log.fields.line}`
      }
      if (log.fields?.column) {
        str += `:${log.fields.column}`
      }
    }
    if (log.fields?.reason) {
      str += `\n${log.fields?.reason}`
    }
    return str
  }

  return 'Unknown error'
}

function getBacktraceFromRustError(err: RustError): string {
  let str = ''
  if (err.is_panic) {
    str += `PANIC`
  }
  if (err.backtrace) {
    str += ` in ${err.backtrace}`
  }
  if (err.message) {
    str += `\n${err.message}`
  }
  return str
}

export function isPanic(err: RustError | RustLog): boolean {
  if (isRustError(err)) {
    return err.is_panic
  }
  return err.fields?.message === 'PANIC'
}

export function isRustLog(e: any): e is RustLog {
  return e.timestamp && typeof e.level === 'string' && typeof e.target === 'string'
}

export function isRustErrorLog(e: any): e is RustLog {
  return isRustLog(e) && (e.level === 'error' || e.fields?.message?.includes('fatal error'))
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
  const level: LogLevel = isQuery ? 'query' : (rustLog.level.toLowerCase() as LogLevel)
  return {
    ...rustLog,
    level,
    timestamp: new Date(rustLog.timestamp),
  }
}

function isQueryLog(fields: any): fields is QueryLogFields {
  return Boolean(fields.query)
}
