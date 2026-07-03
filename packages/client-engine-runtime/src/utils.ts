import { Decimal } from '@prisma/client-runtime-utils'

export type DeepReadonly<T> = T extends undefined | null | boolean | string | number | symbol | Function | Date
  ? T
  : T extends Array<infer U>
    ? ReadonlyArray<DeepReadonly<U>>
    : unknown extends T
      ? unknown
      : { readonly [K in keyof T]: DeepReadonly<T[K]> }

export type DeepUnreadonly<T> = T extends undefined | null | boolean | string | number | symbol | Function | Date
  ? T
  : T extends ReadonlyArray<infer U>
    ? Array<DeepUnreadonly<U>>
    : unknown extends T
      ? unknown
      : { -readonly [K in keyof T]: DeepUnreadonly<T[K]> }

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

  return smallerKeyList.every((key) => doKeyValuesMatch(lhs[key], rhs[key]))
}

export function doKeyValuesMatch(lhs: unknown, rhs: unknown): boolean {
  if (typeof lhs === typeof rhs && typeof lhs !== 'object') {
    return lhs === rhs
  }

  if (Decimal.isDecimal(lhs) || Decimal.isDecimal(rhs)) {
    const lhsDecimal = asDecimal(lhs)
    const rhsDecimal = asDecimal(rhs)
    return lhsDecimal !== undefined && rhsDecimal !== undefined && lhsDecimal.equals(rhsDecimal)
  } else if (lhs instanceof Uint8Array || rhs instanceof Uint8Array) {
    const lhsBuffer = asBuffer(lhs)
    const rhsBuffer = asBuffer(rhs)
    return lhsBuffer !== undefined && rhsBuffer !== undefined && lhsBuffer.equals(rhsBuffer)
  } else if (lhs instanceof Date || rhs instanceof Date) {
    return asDate(lhs)?.getTime() === asDate(rhs)?.getTime()
  } else if (typeof lhs === 'bigint' || typeof rhs === 'bigint') {
    return asBigInt(lhs) === asBigInt(rhs)
  } else if (typeof lhs === 'number' || typeof rhs === 'number') {
    return asNumber(lhs) === asNumber(rhs)
  }

  return isDeepStrictEqual(lhs, rhs)
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
