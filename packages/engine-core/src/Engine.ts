import { RustLog, PanicLogFields, RustError, isRustError } from './log'
import chalk from 'chalk'
import camelCase from 'camelcase'

/**
 * A PrismaClientError is mostly a non-recoverable error like a panic
 */
export class PrismaClientError extends Error {
  constructor(log: RustLog | RustError) {
    let isPanic = false
    let message
    if (typeof log === 'string') {
      message = log
    } else {
      if (isRustError(log)) {
        isPanic = log.is_panic
        message = log.message
        if (isPanic) {
          message += '\n' + log.backtrace
        }
      } else if (log.fields) {
        isPanic = log.fields.message === 'PANIC'
        message = isPanic ? serializePanic(log) : serializeError(log)
      } else {
        message = JSON.stringify(log)
      }
    }
    super(message)
    Object.defineProperty(this, 'isPanic', {
      enumerable: false,
      value: isPanic,
    })
  }
}

export interface QueryEngineError {
  error: string
  user_facing_error: {
    message: string
    meta?: Object
    error_code?: string
  }
}

/**
 * A PrismaClientQueryError is an error that is thrown in conjunction to a concrete query that has been performed with Prisma Client.
 */
export class PrismaClientQueryError extends Error {
  code?: string
  meta?: Object
  constructor(error: QueryEngineError) {
    const code = error.user_facing_error.error_code
    const reason = code ?? 'Reason'
    super(chalk.red.bold(`${reason}: `) + chalk.red(error.user_facing_error.message + '\n'))
    this.code = code
    if (error.user_facing_error.meta) {
      this.meta = mapKeys(error.user_facing_error.meta, key => camelCase(key))
    }
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

/**
 * Engine Base Class used by Browser and Node.js
 */
export abstract class Engine {
  /**
   * Starts the engine
   */
  abstract start(): Promise<void>

  /**
   * If Prisma runs, stop it
   */
  abstract stop(): void

  abstract request<T>(query: string, typeName?: string): Promise<T>

  abstract handleErrors({ errors, query }: { errors?: any; query: string }): void
}
