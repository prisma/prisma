import { type ArgType, type ColumnType, ColumnTypeEnum } from '@prisma/driver-adapter-utils'

/**
 * Infer a Prisma ColumnType from a JavaScript value returned by SurrealDB.
 * SurrealDB does not provide column type metadata in responses,
 * so we rely on runtime type inference from the JS values.
 */
export function inferColumnType(value: unknown): ColumnType {
  if (value === null || value === undefined) {
    // Fallback: null values provide no type information.
    // This may cause type mismatches if the first row has nulls in certain columns.
    return ColumnTypeEnum.Text
  }

  if (typeof value === 'boolean') {
    return ColumnTypeEnum.Boolean
  }

  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      if (value > 2147483647 || value < -2147483648) {
        return ColumnTypeEnum.Int64
      }
      return ColumnTypeEnum.Int32
    }
    return ColumnTypeEnum.Double
  }

  if (typeof value === 'bigint') {
    return ColumnTypeEnum.Int64
  }

  if (typeof value === 'string') {
    if (isIsoDateTime(value)) {
      return ColumnTypeEnum.DateTime
    }
    if (isIsoDate(value)) {
      return ColumnTypeEnum.Date
    }
    if (isUuid(value)) {
      return ColumnTypeEnum.Uuid
    }
    return ColumnTypeEnum.Text
  }

  if (value instanceof Date) {
    return ColumnTypeEnum.DateTime
  }

  if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
    return ColumnTypeEnum.Bytes
  }

  if (Array.isArray(value)) {
    return ColumnTypeEnum.Json
  }

  if (typeof value === 'object') {
    return ColumnTypeEnum.Json
  }

  return ColumnTypeEnum.Text
}

const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Check if a string matches ISO 8601 datetime format. */
function isIsoDateTime(value: string): boolean {
  return ISO_DATETIME_RE.test(value)
}

/** Check if a string matches ISO 8601 date-only format (YYYY-MM-DD). */
function isIsoDate(value: string): boolean {
  return ISO_DATE_RE.test(value)
}

/** Check if a string matches UUID v4 format. */
function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

/**
 * Convert a SurrealDB result row (object) into an ordered array of values
 * matching the given column names.
 */
export function objectToRow(obj: Record<string, unknown>, columnNames: string[]): unknown[] {
  return columnNames.map((name) => {
    const value = obj[name]
    return normalizeValue(value)
  })
}

/**
 * Normalize a SurrealDB value for Prisma's SqlResultSet format.
 * Dates become ISO strings, objects/arrays become JSON strings.
 */
/** Normalize a SurrealDB value for Prisma's SqlResultSet format. */
function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'bigint') {
    return value.toString()
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value)
  }

  if (Array.isArray(value) || (typeof value === 'object' && !(value instanceof Uint8Array) && !ArrayBuffer.isView(value))) {
    return JSON.stringify(value)
  }

  return value
}

/**
 * Map a Prisma argument to a SurrealDB-compatible value.
 */
export function mapArg(arg: unknown, argType: ArgType): unknown {
  if (arg === null) {
    return null
  }

  if (Array.isArray(arg) && argType.arity === 'list') {
    return arg.map((value) => mapArg(value, { ...argType, arity: 'scalar' }))
  }

  if (typeof arg === 'string' && argType.scalarType === 'datetime') {
    const date = new Date(arg)
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid datetime string: ${arg}`)
    }
    return date
  }

  if (typeof arg === 'string' && argType.scalarType === 'bytes') {
    try {
      return Uint8Array.from(atob(arg), (c) => c.charCodeAt(0))
    } catch {
      throw new Error(`Invalid base64 bytes string: ${arg}`)
    }
  }

  return arg
}
