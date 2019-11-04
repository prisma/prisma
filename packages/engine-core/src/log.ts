export type LogLevel = 'INFO' | 'TRACE' | 'DEBUG' | 'WARN' | 'ERROR'

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

export type LogFields = PanicLogFields | InfoLogFields | { [key: string]: any }

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

export interface Log {
  message: string
  level: LogLevel
  date: Date
  application: string
  [key: string]: string | Date
}

export function convertLog(rustLog: RawRustLog): RustLog {
  return {
    ...rustLog,
    timestamp: new Date(rustLog.timestamp),
  }
}
