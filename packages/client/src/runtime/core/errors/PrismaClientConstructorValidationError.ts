import { setClassName } from '@prisma/internals'

export class PrismaClientConstructorValidationError extends Error {
  constructor(message: string) {
    super(`${message}\nRead more at https://pris.ly/d/client-constructor`)
    this.name = 'PrismaClientConstructorValidationError'
  }
  get [Symbol.toStringTag]() {
    return 'PrismaClientConstructorValidationError'
  }
}
setClassName(PrismaClientConstructorValidationError, 'PrismaClientConstructorValidationError')
