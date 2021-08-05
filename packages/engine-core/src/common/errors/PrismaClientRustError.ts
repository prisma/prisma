import { getBacktraceFromLog, getBacktraceFromRustError } from './utils/log'
import { PrismaClientRustErrorArgs } from './types/PrismaClientRustErrorArgs'

/**
 * A generic Prisma Client Rust error.
 * This error is being exposed via the `prisma.$on('error')` interface
 */
export class PrismaClientRustError extends Error {
  clientVersion: string

  constructor({ clientVersion, log, error }: PrismaClientRustErrorArgs) {
    if (log) {
      const backtrace = getBacktraceFromLog(log)
      super(backtrace ?? 'Unkown error')
    } else if (error) {
      const backtrace = getBacktraceFromRustError(error)
      super(backtrace)
    } else {
      // this should never happen
      super(`Unknown error`)
    }

    this.clientVersion = clientVersion
  }
  get [Symbol.toStringTag]() {
    return 'PrismaClientRustPanicError'
  }
}
