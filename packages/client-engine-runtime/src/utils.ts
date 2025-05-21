// Copied over to avoid the heavy dependency on `@prisma/internals` with its
// transitive dependencies that are not needed for other query plan executor
// implementations outside of Prisma Client (e.g. test executor for query
// engine tests and query plan executor for Accelerate) that also depend on

import Decimal from 'decimal.js'

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
    if (typeof lhs[key] !== typeof rhs[key]) {
      if (typeof lhs[key] === 'number' || typeof rhs[key] === 'number') {
        return `${lhs[key]}` === `${rhs[key]}`
      } else if (typeof lhs[key] === 'bigint' || typeof rhs[key] === 'bigint') {
        return BigInt(`${lhs[key]}`) === BigInt(`${rhs[key]}`)
      } else if (lhs[key] instanceof Date || rhs[key] instanceof Date) {
        return new Date(`${lhs[key]}`).getTime() === new Date(`${rhs[key]}`).getTime()
      } else if (Decimal.isDecimal(lhs[key]) || Decimal.isDecimal(rhs[key])) {
        return new Decimal(`${lhs[key]}`).equals(new Decimal(`${rhs[key]}`))
      }
    }

    return isDeepStrictEqual(lhs[key], rhs[key])
  })
}
