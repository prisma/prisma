import { RustLog, PanicLogFields, RustError, isRustError } from './log'
import chalk from 'chalk'
import camelCase from 'camelcase'

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

export function getMessage(log: string | RustLog | RustError) {
  if (typeof log === 'string') {
    return log
  } else if (isRustError(log)) {
    return log.message
  } else if (log.fields && log.fields.message) {
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
    meta?: Object
    error_code?: string
  }
}

export class PrismaClientKnownRequestError extends Error {
  code: string
  meta?: Object
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

function mapKeys<T extends object>(obj: T, mapper: (key: keyof T) => string): any {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    acc[mapper(key as keyof T)] = value
    return acc
  }, {})
}

function serializeError(log) {
  let { target, level, ...rest } = log
  const message = log.message || (log.fields && log.fields.message)

  if (target === 'datamodel') {
    return chalk.red.bold('Schema ') + message
  }
  if (target === 'exit') {
    return chalk.red.bold('Engine exited ' + JSON.stringify(log))
  }
  return chalk.red(log.message + ' ' + serializeObject(rest))
}

function serializePanic(log: RustLog) {
  const fields: PanicLogFields = log.fields as PanicLogFields
  return `${chalk.red.bold('Reason: ')}${chalk.red(
    `${fields.reason} in ${chalk.underline(`${fields.file}:${fields.line}:${fields.column}`)}`,
  )}

Please create an issue in the ${chalk.bold('prisma-client-js')} repo with
your \`schema.prisma\` and the Prisma Client method you tried to use 🙏:
${chalk.underline('https://github.com/prisma/prisma-client-js/issues/new')}\n`
}

function serializeObject(obj) {
  return Object.entries(obj)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(' ')
}
