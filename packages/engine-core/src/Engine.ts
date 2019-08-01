import { Log } from './log'

export class PhotonError extends Error {
  constructor(log: Log) {
    let { application, level, message, ...rest } = log
    message = log.message + ' ' + serializeObject(rest)
    super(message)
    Object.defineProperty(this, 'log', {
      enumerable: false,
      value: log,
    })
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
