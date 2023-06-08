import { setClassName } from '@prisma/internals'

import { PrismaClientRustErrorArgs } from '../engines/common/types/PrismaClientRustErrorArgs'
import { getBacktrace, isPanic } from '../engines/common/utils/log'

/**
 * A generic Prisma Client Rust error.
 * This error is being exposed via the `prisma.$on('error')` interface
 */
export class PrismaClientRustError extends Error {
  clientVersion: string
  private _isPanic: boolean

  constructor({ clientVersion, error }: PrismaClientRustErrorArgs) {
    const backtrace = getBacktrace(error)
    super(backtrace ?? 'Unknown error')

    this._isPanic = isPanic(error)
    this.clientVersion = clientVersion
  }

  get [Symbol.toStringTag]() {
    return 'PrismaClientRustError'
  }

  public isPanic(): boolean {
    return this._isPanic
  }
}

setClassName(PrismaClientRustError, 'PrismaClientRustError')
