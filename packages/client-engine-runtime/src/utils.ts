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

/**
 * Regular expression to match JSON integer values that may lose precision when
 * parsed as JavaScript Number. Matches integers with more than 15 significant digits.
 *
 * The pattern handles integers in both contexts:
 * - Object values: `"key": 12345678901234567,`
 * - Array values: `[12345678901234567,` or `, 12345678901234567,`
 *
 * Uses lookahead (?=...) to avoid consuming the suffix character, allowing
 * consecutive matches in arrays like `[123..., 456...]`.
 *
 * Capturing groups:
 * - Group 1: The prefix (`:`, `[`, or `,` with optional whitespace)
 * - Group 2: The integer value (16+ digits, optionally negative)
 * - Lookahead asserts suffix (`,`, `}`, or `]`) without consuming it
 */
const LARGE_INT_PATTERN = /(:\s*|[,\[]\s*)(-?\d{16,})(?=\s*[,}\]])/g

/**
 * Fast check pattern to detect if a string might contain large integers.
 * Used as a quick pre-filter before applying the more expensive LARGE_INT_PATTERN.
 */
const HAS_LARGE_INT = /\d{16}/

/**
 * `JSON.parse` wrapper that preserves precision for large integer values.
 *
 * JavaScript's Number type can only safely represent integers up to
 * Number.MAX_SAFE_INTEGER (2^53 - 1 = 9007199254740991). Larger integers
 * lose precision when parsed as Number.
 *
 * This function pre-processes the JSON string to convert large integers to
 * strings before parsing, preserving their precision. The data mapper will
 * later convert these string values to BigInt as needed.
 *
 * This is particularly important for relationJoins queries where BigInt foreign
 * key values are embedded in JSON-aggregated relation data from PostgreSQL.
 */
export function safeJsonParse(json: string): unknown {
  // Fast path: skip expensive regex replacement if no 16+ digit sequences exist.
  // This handles the common case where JSON contains no large integers.
  if (!HAS_LARGE_INT.test(json)) {
    return JSON.parse(json)
  }

  // Slow path: replace large integers with quoted strings to preserve precision.
  // Numbers with 16+ digits may exceed MAX_SAFE_INTEGER and lose precision.
  const safeJson = json.replace(LARGE_INT_PATTERN, (_match, prefix, num) => {
    return `${prefix}"${num}"`
  })
  return JSON.parse(safeJson)
}
