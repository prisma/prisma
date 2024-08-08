import type { ArgType } from '@prisma/driver-adapter-utils'

// Sanitize the query arguments before sending them to the database.
export function cleanArg(arg: unknown, argType: ArgType): unknown {
  if (arg !== null) {
    if (argType === 'Int64') {
      const asInt56 = Number.parseInt(arg as string)
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

// When we receive the result, we only get the error message, not the error code.
// Example:
// "name":"Error","message":"D1_ERROR: UNIQUE constraint failed: User.email"
// So we try to match some errors and use the generic error code as a fallback.
// https://www.sqlite.org/rescode.html
//
// 1 = The SQLITE_ERROR result code is a generic error code that is used when no other more specific error code is available.
// See quaint https://github.com/prisma/prisma-engines/blob/main/quaint/src/connector/sqlite/error.rs
// some errors are matched by the extended code and others by the message there.
export function matchSQLiteErrorCode(message: string): number {
  let extendedCode = 1
  if (!message) return extendedCode

  if (message.startsWith('D1_ERROR: UNIQUE constraint failed:')) {
    extendedCode = 2067
  } else if (message.startsWith('D1_ERROR: FOREIGN KEY constraint failed')) {
    extendedCode = 787
  } else if (message.startsWith('D1_ERROR: NOT NULL constraint failed')) {
    extendedCode = 1299
  }
  // These below were added based on
  // https://github.com/prisma/prisma-engines/blob/main/quaint/src/connector/sqlite/error.rs
  // https://github.com/prisma/prisma-engines/blob/main/quaint/src/connector/sqlite/ffi.rs
  else if (message.startsWith('D1_ERROR: CHECK constraint failed')) {
    extendedCode = 1811
  } else if (message.startsWith('D1_ERROR: PRIMARY KEY constraint failed')) {
    extendedCode = 1555
  }

  return extendedCode
}
