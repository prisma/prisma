import {
  RustLog,
  //  PanicLogFields,
  RustError,
  isRustError,
} from './log'
// import chalk from 'chalk'

export class PrismaQueryEngineError extends Error {
  /**
   * HTTP Code
   */
  code: number
  constructor(message: string, code: number) {
    super(message)
    this.code = code
  }
}

export function getMessage(log: string | RustLog | RustError | any): string {
  if (typeof log === 'string') {
    return log
  } else if (isRustError(log)) {
    return log.message
  } else if (log.fields && log.fields.message) {
    if (log.fields.reason) {
      return `${log.fields.message}: ${log.fields.reason}`
    }
    return log.fields.message
  } else {
    return JSON.stringify(log)
  }
}

export interface RequestError {
  error: string
  user_facing_error: {
    is_panic: boolean
    message: string
    meta?: object
    error_code?: string
  }
}

export class PrismaClientKnownRequestError extends Error {
  code: string
  meta?: object
  constructor(message: string, code: string, meta?: any) {
    super(message)
    this.code = code
    this.meta = meta
  }
}

export class PrismaClientUnknownRequestError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export class PrismaClientRustPanicError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export class PrismaClientInitializationError extends Error {
  constructor(message: string) {
    super(message)
  }
}
