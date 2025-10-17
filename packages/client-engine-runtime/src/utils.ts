import { Decimal } from '@prisma/client-runtime-utils'

// Copied over to avoid the heavy dependency on `@prisma/internals` with its
// transitive dependencies that are not needed for other query plan executor
// implementations outside of Prisma Client (e.g. test executor for query
// engine tests and query plan executor for Accelerate) that also depend on
// `@prisma/client-engine-runtime`.
export function assertNever(_: never, message: string): never {
  throw new Error(message)
}

/**
 * Checks if two objects are deeply equal, recursively checking all properties for strict equality.
 */
export function isDeepStrictEqual(a: unknown, b: unknown): boolean {
  return (
    a === b ||
    (a !== null &&
      b !== null &&
      typeof a === 'object' &&
      typeof b === 'object' &&
      Object.keys(a).length === Object.keys(b).length &&
      Object.keys(a).every((key) => isDeepStrictEqual(a[key], b[key])))
  )
}

/**
 * Checks if two objects representing the names and values of key columns match. A match is
 * defined by one of the sets of keys being a subset of the other. This function also
 * converts arguments to the types used by driver adapters if necessary.
 */
export function doKeysMatch(lhs: {}, rhs: {}): boolean {
  const lhsKeys = Object.keys(lhs)
  const rhsKeys = Object.keys(rhs)
  const smallerKeyList = lhsKeys.length < rhsKeys.length ? lhsKeys : rhsKeys

  return smallerKeyList.every((key) => {
    if (typeof lhs[key] === typeof rhs[key] && typeof lhs[key] !== 'object') {
      // fast path for primitive types
      return lhs[key] === rhs[key]
    }

    if (Decimal.isDecimal(lhs[key]) || Decimal.isDecimal(rhs[key])) {
      const lhsDecimal = asDecimal(lhs[key])
      const rhsDecimal = asDecimal(rhs[key])
      return lhsDecimal && rhsDecimal && lhsDecimal.equals(rhsDecimal)
    } else if (lhs[key] instanceof Uint8Array || rhs[key] instanceof Uint8Array) {
      const lhsBuffer = asBuffer(lhs[key])
      const rhsBuffer = asBuffer(rhs[key])
      return lhsBuffer && rhsBuffer && lhsBuffer.equals(rhsBuffer)
    } else if (lhs[key] instanceof Date || rhs[key] instanceof Date) {
      return asDate(lhs[key])?.getTime() === asDate(rhs[key])?.getTime()
    } else if (typeof lhs[key] === 'bigint' || typeof rhs[key] === 'bigint') {
      return asBigInt(lhs[key]) === asBigInt(rhs[key])
    } else if (typeof lhs[key] === 'number' || typeof rhs[key] === 'number') {
      return asNumber(lhs[key]) === asNumber(rhs[key])
    }

    return isDeepStrictEqual(lhs[key], rhs[key])
  })
}

function asDecimal(value: unknown): Decimal | undefined {
  if (Decimal.isDecimal(value)) {
    return value
  } else if (typeof value === 'number' || typeof value === 'string') {
    return new Decimal(value)
  } else {
    return
  }
}

function asBuffer(value: unknown): Buffer | undefined {
  if (Buffer.isBuffer(value)) {
    return value
  } else if (value instanceof Uint8Array) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
  } else if (typeof value === 'string') {
    return Buffer.from(value, 'base64')
  } else {
    return
  }
}

function asDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return value
  } else if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value)
  } else {
    return
  }
}

function asBigInt(value: unknown): bigint | undefined {
  if (typeof value === 'bigint') {
    return value
  } else if (typeof value === 'number' || typeof value === 'string') {
    return BigInt(value)
  } else {
    return
  }
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return value
  } else if (typeof value === 'string') {
    return Number(value)
  } else {
    return
  }
}

/**
 * `JSON.stringify` wrapper with custom replacer function that handles nested
 * BigInt and Uint8Array values.
 */
export function safeJsonStringify(obj: unknown): string {
  return JSON.stringify(obj, (_key, val) => {
    if (typeof val === 'bigint') {
      return val.toString()
    } else if (ArrayBuffer.isView(val)) {
      return Buffer.from(val.buffer, val.byteOffset, val.byteLength).toString('base64')
    }
    return val
  })
}
