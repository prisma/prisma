import { setClassName } from '@prisma/internals'

export class PrismaClientValidationError extends Error {
  name = 'PrismaClientValidationError'
  
  get [Symbol.toStringTag]() {
    return 'PrismaClientValidationError'
  }
}
setClassName(PrismaClientValidationError, 'PrismaClientValidationError')
