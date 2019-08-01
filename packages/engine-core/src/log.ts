type RustLogLevel = 'CRIT' | 'ERRO' | 'WARN' | 'INFO' | 'DEBG' | 'TRCE'

export type LogLevel = 'critical' | 'error' | 'warning' | 'info' | 'debug' | 'trace'

const logLevelMap = {
  CRIT: 'critical',
  ERRO: 'error',
  WARN: 'warning',
  INFO: 'info',
  DEBG: 'debug',
  TRCE: 'trace',
}

export interface RustLog {
  msg: string
  level: RustLogLevel
  ts: string
  application: string
}

export interface Log {
  message: string
  level: LogLevel
  date: Date
  application: string
  [key: string]: string | Date
}

function rustToPublicLogLevel(rustLevel: RustLogLevel): LogLevel {
  return logLevelMap[rustLevel] as LogLevel
}

export function convertLog(rustLog: RustLog): Log {
  return {
    message: rustLog.msg,
    level: rustToPublicLogLevel(rustLog.level),
    application: rustLog.application,
    date: new Date(rustLog.ts),
  }
}
