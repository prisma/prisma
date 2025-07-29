import type { ArgType } from '@prisma/driver-adapter-utils'

// Sanitize the query arguments before sending them to the database.
export function cleanArg(arg: unknown, argType: ArgType): unknown {
  if (arg !== null) {
    if (argType === 'Int64' || typeof arg === 'bigint') {
      const asInt56 = Number.parseInt(`${arg}`)
      if (!Number.isSafeInteger(asInt56)) {
        throw new Error(`Invalid Int64-encoded value received: ${arg}`)
      }

      return asInt56
    }

    if (argType === 'Int32') {
      return Number.parseInt(arg as string)
    }

    if (argType === 'Float' || argType === 'Double') {
      return Number.parseFloat(arg as string)
    }

    // * Hack for booleans, we must convert them to 0/1.
    // * ✘ [ERROR] Error in performIO: Error: D1_TYPE_ERROR: Type 'boolean' not supported for value 'true'
    if (arg === true) {
      return 1
    }

    if (arg === false) {
      return 0
    }

    if (arg instanceof Uint8Array) {
      return Array.from(arg)
    }
  }

  return arg
}
