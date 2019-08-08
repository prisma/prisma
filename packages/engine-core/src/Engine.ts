import { Log } from './log'
import chalk from 'chalk'

export class PhotonError extends Error {
  constructor(log: Log) {
    const isPanic = log.message === 'PANIC'
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
  return chalk.red(log.message + ' ' + serializeObject(rest))
}

function serializePanic(log) {
  return `${chalk.red.bold('Reason: ')}${chalk.red(
    `${log.reason} in ${chalk.underline(`${log.file}:${log.line}:${log.column}`)}`,
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
    .map(([key, value]) => `${key}=${JSON.parse(JSON.stringify(value))}`)
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
