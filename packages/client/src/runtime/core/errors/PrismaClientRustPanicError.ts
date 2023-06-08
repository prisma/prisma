import { setClassName } from '@prisma/internals'

export class PrismaClientRustPanicError extends Error {
  clientVersion: string

  constructor(message: string, clientVersion: string) {
    super(message)

    this.clientVersion = clientVersion
  }
  get [Symbol.toStringTag]() {
    return 'PrismaClientRustPanicError'
  }
}

setClassName(PrismaClientRustPanicError, 'PrismaClientRustPanicError')
