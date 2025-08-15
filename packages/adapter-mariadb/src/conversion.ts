import { ColumnType, ColumnTypeEnum } from '@prisma/driver-adapter-utils'
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
      if (field.flags.valueOf() & BINARY_FLAG) {
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

export function mapArg(arg: unknown): unknown {
  if (arg instanceof Uint8Array) {
    return Buffer.from(arg.buffer, arg.byteOffset, arg.byteLength)
  }
  return arg
}

export function mapRow(row: unknown[], fields?: mariadb.FieldInfo[]): unknown[] {
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
        return new Date(`${value}Z`).toISOString()
    }

    if (Buffer.isBuffer(value)) {
      return Array.from(value)
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
