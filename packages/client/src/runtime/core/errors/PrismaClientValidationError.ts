import { setClassName } from '@prisma/internals'

export class PrismaClientValidationError extends Error {
  get [Symbol.toStringTag]() {
    return 'PrismaClientValidationError'
  }
}
setClassName(PrismaClientValidationError, 'PrismaClientValidationError')
