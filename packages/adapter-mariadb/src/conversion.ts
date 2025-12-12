import { ArgType, ColumnType, ColumnTypeEnum, ResultValue } from '@prisma/driver-adapter-utils'
import * as mariadb from 'mariadb'

const UNSIGNED_FLAG = 1 << 5
const BINARY_FLAG = 1 << 7

const enum MariaDbColumnType {
  DECIMAL = 'DECIMAL',
  TINY = 'TINY',
  SHORT = 'SHORT',
  INT = 'INT',
  LONG = 'LONG',
  FLOAT = 'FLOAT',
  DOUBLE = 'DOUBLE',
  NULL = 'NULL',
  TIMESTAMP = 'TIMESTAMP',
  BIGINT = 'BIGINT',
  INT24 = 'INT24',
  DATE = 'DATE',
  TIME = 'TIME',
  DATETIME = 'DATETIME',
  YEAR = 'YEAR',
  NEWDATE = 'NEWDATE',
  VARCHAR = 'VARCHAR',
  BIT = 'BIT',
  TIMESTAMP2 = 'TIMESTAMP2',
  DATETIME2 = 'DATETIME2',
  TIME2 = 'TIME2',
  JSON = 'JSON',
  NEWDECIMAL = 'NEWDECIMAL',
  ENUM = 'ENUM',
  SET = 'SET',
  TINY_BLOB = 'TINY_BLOB',
  MEDIUM_BLOB = 'MEDIUM_BLOB',
  LONG_BLOB = 'LONG_BLOB',
  BLOB = 'BLOB',
  VAR_STRING = 'VAR_STRING',
  STRING = 'STRING',
  GEOMETRY = 'GEOMETRY',
}

export function mapColumnType(field: mariadb.FieldInfo): ColumnType {
  switch (field.type as unknown as MariaDbColumnType) {
    case MariaDbColumnType.TINY:
    case MariaDbColumnType.SHORT:
    case MariaDbColumnType.INT24:
    case MariaDbColumnType.YEAR:
      return ColumnTypeEnum.Int32
    case MariaDbColumnType.INT:
      if (field.flags.valueOf() & UNSIGNED_FLAG) {
        return ColumnTypeEnum.Int64
      } else {
        return ColumnTypeEnum.Int32
      }
    case MariaDbColumnType.LONG:
    case MariaDbColumnType.BIGINT:
      return ColumnTypeEnum.Int64
    case MariaDbColumnType.FLOAT:
      return ColumnTypeEnum.Float
    case MariaDbColumnType.DOUBLE:
      return ColumnTypeEnum.Double
    case MariaDbColumnType.TIMESTAMP:
    case MariaDbColumnType.TIMESTAMP2:
    case MariaDbColumnType.DATETIME:
    case MariaDbColumnType.DATETIME2:
      return ColumnTypeEnum.DateTime
    case MariaDbColumnType.DATE:
    case MariaDbColumnType.NEWDATE:
      return ColumnTypeEnum.Date
    case MariaDbColumnType.TIME:
      return ColumnTypeEnum.Time
    case MariaDbColumnType.DECIMAL:
    case MariaDbColumnType.NEWDECIMAL:
      return ColumnTypeEnum.Numeric
    case MariaDbColumnType.VARCHAR:
    case MariaDbColumnType.VAR_STRING:
    case MariaDbColumnType.STRING:
    case MariaDbColumnType.BLOB:
    case MariaDbColumnType.TINY_BLOB:
    case MariaDbColumnType.MEDIUM_BLOB:
    case MariaDbColumnType.LONG_BLOB:
      // Special handling for MariaDB, the database returns JSON columns as BLOB
      // https://github.com/mariadb-corporation/mariadb-connector-nodejs/blob/1bbbb41e92d2123948c2322a4dbb5021026f2d05/lib/cmd/column-definition.js#L27
      if (field['dataTypeFormat'] === 'json') {
        return ColumnTypeEnum.Json
      } else if (field.flags.valueOf() & BINARY_FLAG) {
        return ColumnTypeEnum.Bytes
      } else {
        return ColumnTypeEnum.Text
      }
    case MariaDbColumnType.ENUM:
      return ColumnTypeEnum.Enum
    case MariaDbColumnType.JSON:
      return ColumnTypeEnum.Json
    case MariaDbColumnType.BIT:
    case MariaDbColumnType.GEOMETRY:
      return ColumnTypeEnum.Bytes
    case MariaDbColumnType.NULL:
      // Fall back to Int32 for consistency with quaint.
      return ColumnTypeEnum.Int32
    default:
      throw new Error(`Unsupported column type: ${field.type}`)
  }
}

export function mapArg<A>(arg: A | Date, argType: ArgType): null | BigInt | string | Buffer | A {
  if (arg === null) {
    return null
  }

  if (typeof arg === 'string' && argType.scalarType === 'bigint') {
    return BigInt(arg)
  }

  if (typeof arg === 'string' && argType.scalarType === 'datetime') {
    arg = new Date(arg)
  }

  if (arg instanceof Date) {
    switch (argType.dbType) {
      case MariaDbColumnType.TIME:
      case MariaDbColumnType.TIME2:
        return formatTime(arg)
      case MariaDbColumnType.DATE:
      case MariaDbColumnType.NEWDATE:
        return formatDate(arg)
      default:
        return formatDateTime(arg)
    }
  }

  if (typeof arg === 'string' && argType.scalarType === 'bytes') {
    return Buffer.from(arg, 'base64')
  }

  if (ArrayBuffer.isView(arg)) {
    return Buffer.from(arg.buffer, arg.byteOffset, arg.byteLength)
  }

  return arg
}

export function mapRow<A>(row: A[], fields?: mariadb.FieldInfo[]): (A | ResultValue)[] {
  return row.map((value, i) => {
    const type = fields?.[i].type as unknown as MariaDbColumnType

    if (value === null) {
      return null
    }

    switch (type) {
      case MariaDbColumnType.TIMESTAMP:
      case MariaDbColumnType.TIMESTAMP2:
      case MariaDbColumnType.DATETIME:
      case MariaDbColumnType.DATETIME2:
        return new Date(`${value}Z`).toISOString().replace(/(\.000)?Z$/, '+00:00')
    }

    if (typeof value === 'bigint') {
      return value.toString()
    }

    return value
  })
}

export const typeCast: mariadb.TypeCastFunction = (field, next) => {
  if ((field.type as unknown as MariaDbColumnType) === MariaDbColumnType.GEOMETRY) {
    return field.buffer()
  }
  return next()
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
