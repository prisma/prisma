import { setClassName } from '@prisma/internals'

import { PrismaClientKnownRequestError } from './PrismaClientKnownRequestError'

/**
 * @deprecated Please don´t rely on type checks to this error anymore.
 * This will become a regular `PrismaClientKnownRequestError` with code `P2025`
 * in the future major version of the client.
 * Instead of `error instanceof Prisma.NotFoundError` use `error.code === "P2025"`.
 */
export class NotFoundError extends PrismaClientKnownRequestError {
  constructor(message: string, clientVersion: string) {
    super(message, { code: 'P2025', clientVersion })
    this.name = 'NotFoundError'
  }
}
setClassName(NotFoundError, 'NotFoundError')
