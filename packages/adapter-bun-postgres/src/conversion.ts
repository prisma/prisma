import { ArgType, ColumnType, ColumnTypeEnum } from '@prisma/driver-adapter-utils'

const isoDateRegex = new RegExp(
  /^(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))$|^(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))$|^(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))$/,
)

const dateRegex = /^\d{4}-\d{2}-\d{2}$/
const timeRegex = /^\d{2}:\d{2}:\d{2}(?:\.\d+)?$/
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const decimalRegex = /^-?(?:\d+\.\d+|\d+\.\d*|\d*\.\d+)(?:e[+-]?\d+)?$/i
const exponentRegex = /^-?\d+e[+-]?\d+$/i

export function getColumnTypes(columnNames: string[], rows: unknown[][]): ColumnType[] {
  const columnTypes: (ColumnType | undefined)[] = new Array(columnNames.length)

  for (let columnIndex = 0; columnIndex < columnNames.length; columnIndex++) {
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const value = rows[rowIndex][columnIndex]
      if (value === null || value === undefined) {
        continue
      }

      const inferred = inferColumnType(value)
      const current = columnTypes[columnIndex]

      columnTypes[columnIndex] = current === undefined ? inferred : reconcileColumnType(current, inferred)
    }

    if (columnTypes[columnIndex] === undefined) {
      // Mirrors the fallback that other adapters use when type metadata is unavailable.
      columnTypes[columnIndex] = ColumnTypeEnum.Int32
    }
  }

  return columnTypes as ColumnType[]
}

function inferColumnType(value: unknown): ColumnType {
  if (typeof value === 'bigint') {
    return ColumnTypeEnum.Int64
  }

  if (typeof value === 'number') {
    if (Number.isInteger(value) && value <= 2 ** 31 - 1 && value >= -(2 ** 31)) {
      return ColumnTypeEnum.Int32
    }

    return ColumnTypeEnum.UnknownNumber
  }

  if (typeof value === 'boolean') {
    return ColumnTypeEnum.Boolean
  }

  if (typeof value === 'string') {
    return inferStringColumnType(value)
  }

  if (value instanceof Date) {
    return ColumnTypeEnum.DateTime
  }

  if (isBytes(value)) {
    return ColumnTypeEnum.Bytes
  }

  if (Array.isArray(value)) {
    return inferArrayColumnType(value)
  }

  if (typeof value === 'object' && value !== null) {
    return ColumnTypeEnum.Json
  }

  return ColumnTypeEnum.Text
}

function inferArrayColumnType(value: unknown[]): ColumnType {
  let inferred: ColumnType | undefined

  for (const element of value) {
    if (element === null || element === undefined) {
      continue
    }

    const current = inferArrayElementType(element)
    inferred = inferred === undefined ? current : reconcileColumnType(inferred, current)
  }

  return inferred ?? ColumnTypeEnum.TextArray
}

function inferArrayElementType(value: unknown): ColumnType {
  if (typeof value === 'bigint') {
    return ColumnTypeEnum.Int64Array
  }

  if (typeof value === 'number') {
    if (Number.isInteger(value) && value <= 2 ** 31 - 1 && value >= -(2 ** 31)) {
      return ColumnTypeEnum.Int32Array
    }

    return ColumnTypeEnum.DoubleArray
  }

  if (typeof value === 'boolean') {
    return ColumnTypeEnum.BooleanArray
  }

  if (typeof value === 'string') {
    const scalarType = inferStringColumnType(value)
    switch (scalarType) {
      case ColumnTypeEnum.Numeric:
        return ColumnTypeEnum.NumericArray
      case ColumnTypeEnum.Time:
        return ColumnTypeEnum.TimeArray
      case ColumnTypeEnum.Date:
        return ColumnTypeEnum.DateArray
      case ColumnTypeEnum.DateTime:
        return ColumnTypeEnum.DateTimeArray
      case ColumnTypeEnum.Uuid:
        return ColumnTypeEnum.UuidArray
      case ColumnTypeEnum.Json:
        return ColumnTypeEnum.JsonArray
      default:
        return ColumnTypeEnum.TextArray
    }
  }

  if (value instanceof Date) {
    return ColumnTypeEnum.DateTimeArray
  }

  if (isBytes(value)) {
    return ColumnTypeEnum.BytesArray
  }

  if (typeof value === 'object' && value !== null) {
    return ColumnTypeEnum.JsonArray
  }

  return ColumnTypeEnum.TextArray
}

function inferStringColumnType(value: string): ColumnType {
  if (dateRegex.test(value)) {
    return ColumnTypeEnum.Date
  }

  if (timeRegex.test(value)) {
    return ColumnTypeEnum.Time
  }

  if (isoDateRegex.test(value)) {
    return ColumnTypeEnum.DateTime
  }

  if (uuidRegex.test(value)) {
    return ColumnTypeEnum.Uuid
  }

  if ((decimalRegex.test(value) || exponentRegex.test(value)) && value.length > 0) {
    return ColumnTypeEnum.Numeric
  }

  if (looksLikeJson(value)) {
    return ColumnTypeEnum.Json
  }

  return ColumnTypeEnum.Text
}

function looksLikeJson(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return false
  }

  const firstChar = trimmed[0]
  if (firstChar !== '{' && firstChar !== '[') {
    return false
  }

  try {
    const parsed = JSON.parse(trimmed)
    return typeof parsed === 'object' && parsed !== null
  } catch {
    return false
  }
}

function reconcileColumnType(current: ColumnType, next: ColumnType): ColumnType {
  if (current === next) {
    return current
  }

  if (current === ColumnTypeEnum.UnknownNumber) {
    return next
  }

  if (next === ColumnTypeEnum.UnknownNumber) {
    return current
  }

  if (
    (current === ColumnTypeEnum.Int32 && (next === ColumnTypeEnum.Double || next === ColumnTypeEnum.Numeric)) ||
    (next === ColumnTypeEnum.Int32 && (current === ColumnTypeEnum.Double || current === ColumnTypeEnum.Numeric))
  ) {
    return next === ColumnTypeEnum.Numeric || current === ColumnTypeEnum.Numeric
      ? ColumnTypeEnum.Numeric
      : ColumnTypeEnum.Double
  }

  if (
    (current === ColumnTypeEnum.Int32Array &&
      (next === ColumnTypeEnum.DoubleArray || next === ColumnTypeEnum.NumericArray)) ||
    (next === ColumnTypeEnum.Int32Array &&
      (current === ColumnTypeEnum.DoubleArray || current === ColumnTypeEnum.NumericArray))
  ) {
    return next === ColumnTypeEnum.NumericArray || current === ColumnTypeEnum.NumericArray
      ? ColumnTypeEnum.NumericArray
      : ColumnTypeEnum.DoubleArray
  }

  if (
    (current === ColumnTypeEnum.Date && next === ColumnTypeEnum.DateTime) ||
    (current === ColumnTypeEnum.DateTime && next === ColumnTypeEnum.Date)
  ) {
    return ColumnTypeEnum.DateTime
  }

  if (
    (current === ColumnTypeEnum.DateArray && next === ColumnTypeEnum.DateTimeArray) ||
    (current === ColumnTypeEnum.DateTimeArray && next === ColumnTypeEnum.DateArray)
  ) {
    return ColumnTypeEnum.DateTimeArray
  }

  if (isArrayType(current) && isArrayType(next)) {
    return ColumnTypeEnum.TextArray
  }

  return ColumnTypeEnum.Text
}

function isArrayType(type: ColumnType): boolean {
  return type >= 64 && type < 128
}

export function mapRow(row: unknown[], columnTypes: ColumnType[]): unknown[] {
  const mapped = [...row]

  for (let i = 0; i < mapped.length; i++) {
    const value = mapped[i]

    if (value === undefined) {
      mapped[i] = null
      continue
    }

    switch (columnTypes[i]) {
      case ColumnTypeEnum.Int64:
        if (typeof value === 'bigint') {
          mapped[i] = value.toString()
        }
        continue
      case ColumnTypeEnum.Int64Array:
        if (Array.isArray(value)) {
          mapped[i] = value.map((element) => (typeof element === 'bigint' ? element.toString() : element))
        }
        continue
      case ColumnTypeEnum.Date:
        if (value instanceof Date) {
          mapped[i] = formatDate(value)
        }
        continue
      case ColumnTypeEnum.DateArray:
        if (Array.isArray(value)) {
          mapped[i] = value.map((element) => (element instanceof Date ? formatDate(element) : element))
        }
        continue
      case ColumnTypeEnum.Time:
        if (value instanceof Date) {
          mapped[i] = formatTime(value)
        }
        continue
      case ColumnTypeEnum.TimeArray:
        if (Array.isArray(value)) {
          mapped[i] = value.map((element) => (element instanceof Date ? formatTime(element) : element))
        }
        continue
      case ColumnTypeEnum.DateTime:
        if (value instanceof Date) {
          mapped[i] = formatDateTimeRfc3339(value)
        }
        continue
      case ColumnTypeEnum.DateTimeArray:
        if (Array.isArray(value)) {
          mapped[i] = value.map((element) => (element instanceof Date ? formatDateTimeRfc3339(element) : element))
        }
        continue
      case ColumnTypeEnum.Bytes:
        mapped[i] = toUint8Array(value)
        continue
      case ColumnTypeEnum.BytesArray:
        if (Array.isArray(value)) {
          mapped[i] = value.map((element) => toUint8Array(element))
        }
        continue
      case ColumnTypeEnum.Json:
        if (typeof value !== 'string') {
          mapped[i] = JSON.stringify(value)
        }
        continue
      case ColumnTypeEnum.JsonArray:
        if (Array.isArray(value)) {
          mapped[i] = value.map((element) => (typeof element === 'string' ? element : JSON.stringify(element)))
        }
        continue
      default:
        continue
    }
  }

  return mapped
}

function toUint8Array(value: unknown): unknown {
  if (isBytes(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value)
  }

  return value
}

function isBytes(value: unknown): value is Uint8Array {
  return ArrayBuffer.isView(value)
}

export function mapArg<A>(arg: A | Date, argType: ArgType): null | unknown[] | string | Uint8Array | A {
  if (arg === null) {
    return null
  }

  if (Array.isArray(arg) && argType.arity === 'list') {
    return arg.map((value) => mapArg(value, argType))
  }

  if (typeof arg === 'string' && argType.scalarType === 'datetime') {
    arg = new Date(arg)
  }

  if (arg instanceof Date) {
    switch (argType.dbType) {
      case 'TIME':
      case 'TIMETZ':
        return formatTime(arg)
      case 'DATE':
        return formatDate(arg)
      default:
        return formatDateTime(arg)
    }
  }

  if (typeof arg === 'string' && argType.scalarType === 'bytes') {
    return Buffer.from(arg, 'base64')
  }

  if (ArrayBuffer.isView(arg)) {
    return new Uint8Array(arg.buffer, arg.byteOffset, arg.byteLength)
  }

  return arg
}

function formatDateTime(date: Date): string {
  const pad = (n: number, z = 2) => String(n).padStart(z, '0')
  const ms = date.getUTCMilliseconds()

  return (
    pad(date.getUTCFullYear(), 4) +
    '-' +
    pad(date.getUTCMonth() + 1) +
    '-' +
    pad(date.getUTCDate()) +
    ' ' +
    pad(date.getUTCHours()) +
    ':' +
    pad(date.getUTCMinutes()) +
    ':' +
    pad(date.getUTCSeconds()) +
    (ms ? '.' + String(ms).padStart(3, '0') : '')
  )
}

function formatDate(date: Date): string {
  const pad = (n: number, z = 2) => String(n).padStart(z, '0')
  return pad(date.getUTCFullYear(), 4) + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate())
}

function formatTime(date: Date): string {
  const pad = (n: number, z = 2) => String(n).padStart(z, '0')
  const ms = date.getUTCMilliseconds()

  return (
    pad(date.getUTCHours()) +
    ':' +
    pad(date.getUTCMinutes()) +
    ':' +
    pad(date.getUTCSeconds()) +
    (ms ? '.' + String(ms).padStart(3, '0') : '')
  )
}

function formatDateTimeRfc3339(date: Date): string {
  return date.toISOString().replace('Z', '+00:00')
}
