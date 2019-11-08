import { RustLog, PanicLogFields } from './log'
import chalk from 'chalk'

export class PhotonError extends Error {
  constructor(log: RustLog) {
    const isPanic = log.fields.message === 'PANIC'
    const message = isPanic ? serializePanic(log) : serializeError(log)
    super(message)
    Object.defineProperty(this, 'log', {
      enumerable: false,
      value: log,
    })
    Object.defineProperty(this, 'isPanic', {
      enumerable: false,
      value: isPanic,
    })
  }
}

function serializeError(log) {
  let { application, level, message, ...rest } = log
  if (application === 'datamodel') {
    return chalk.red.bold('Schema ') + message
  }
  if (application === 'exit') {
    return chalk.red.bold('Engine exited ') + message
  }
  return chalk.red(log.message + ' ' + serializeObject(rest))
}

function serializePanic(log: RustLog) {
  const fields: PanicLogFields = log.fields as PanicLogFields
  return `${chalk.red.bold('Reason: ')}${chalk.red(
    `${fields.reason} in ${chalk.underline(`${fields.file}:${fields.line}:${fields.column}`)}`,
  )}

Please create an issue in the ${chalk.bold('photonjs')} repo with
your \`schema.prisma\` and the Photon method you tried to use 🙏:
${chalk.underline('https://github.com/prisma/photonjs/issues/new')}\n`
}

export class PhotonQueryError extends Error {
  constructor(message: string) {
    super(chalk.red.bold('Reason: ') + chalk.red(message + '\n'))
  }
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
