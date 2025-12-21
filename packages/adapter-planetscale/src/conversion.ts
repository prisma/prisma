import { cast as defaultCast } from '@planetscale/database'
import { ArgType, type ColumnType, ColumnTypeEnum } from '@prisma/driver-adapter-utils'

import { decodeUtf8 } from './text'

// See: https://github.com/planetscale/vitess-types/blob/06235e372d2050b4c0fff49972df8111e696c564/src/vitess/query/v16/query.proto#L108-L218
export type PlanetScaleColumnType =
  | 'NULL'
  | 'INT8'
  | 'UINT8'
  | 'INT16'
  | 'UINT16'
  | 'INT24'
  | 'UINT24'
  | 'INT32'
  | 'UINT32'
  | 'INT64'
  | 'UINT64'
  | 'FLOAT32'
  | 'FLOAT64'
  | 'TIMESTAMP'
  | 'DATE'
  | 'TIME'
  | 'DATETIME'
  | 'YEAR'
  | 'DECIMAL'
  | 'TEXT'
  | 'BLOB'
  | 'VARCHAR'
  | 'VARBINARY'
  | 'CHAR'
  | 'BINARY'
  | 'BIT'
  | 'ENUM'
  | 'SET' // unsupported
  | 'TUPLE' // unsupported
  | 'GEOMETRY'
  | 'JSON'
  | 'EXPRESSION' // unsupported
  | 'HEXNUM'
  | 'HEXVAL'
  | 'BITNUM'

/**
 * This is a simplification of quaint's value inference logic. Take a look at quaint's conversion.rs
 * module to see how other attributes of the field packet such as the field length are used to infer
 * the correct quaint::Value variant.
 */
export function fieldToColumnType(field: PlanetScaleColumnType): ColumnType {
  switch (field) {
    case 'INT8':
    case 'UINT8':
    case 'INT16':
    case 'UINT16':
    case 'INT24':
    case 'UINT24':
    case 'INT32':
    case 'YEAR':
      return ColumnTypeEnum.Int32
    case 'UINT32':
    case 'INT64':
    case 'UINT64':
      return ColumnTypeEnum.Int64
    case 'FLOAT32':
      return ColumnTypeEnum.Float
    case 'FLOAT64':
      return ColumnTypeEnum.Double
    case 'TIMESTAMP':
    case 'DATETIME':
      return ColumnTypeEnum.DateTime
    case 'DATE':
      return ColumnTypeEnum.Date
    case 'TIME':
      return ColumnTypeEnum.Time
    case 'DECIMAL':
      return ColumnTypeEnum.Numeric
    case 'CHAR':
    case 'TEXT':
    case 'VARCHAR':
      return ColumnTypeEnum.Text
    case 'ENUM':
      return ColumnTypeEnum.Enum
    case 'JSON':
      return ColumnTypeEnum.Json
    case 'BLOB':
    case 'BINARY':
    case 'VARBINARY':
    case 'BIT':
    case 'BITNUM':
    case 'HEXNUM':
    case 'HEXVAL':
    case 'GEOMETRY':
      return ColumnTypeEnum.Bytes
    case 'NULL':
      // Fall back to Int32 for consistency with quaint.
      return ColumnTypeEnum.Int32
    default:
      throw new Error(`Unsupported column type: ${field}`)
  }
}

export const cast: typeof defaultCast = (field, value) => {
  if (field.type === 'JSON') {
    return typeof value === 'string' && value.length ? decodeUtf8(value) : value
  }

  return defaultCast(field, value)
}

export function mapArg<A>(arg: A | Date, argType: ArgType): null | BigInt | string | Uint8Array | A {
  if (arg === null) {
    return null
  }

  if (typeof arg === 'string' && argType.scalarType === 'bigint') {
    return BigInt(arg)
  }

  if (argType.scalarType === 'datetime' && typeof arg === 'string') {
    arg = new Date(arg)
  }

  if (arg instanceof Date) {
    switch (argType.dbType) {
      case 'TIME':
      case 'TIME2':
        return formatTime(arg)
      case 'DATE':
      case 'NEWDATE':
        return formatDate(arg)
      default:
        return formatDateTime(arg)
    }
  }

  if (typeof arg === 'string' && argType.scalarType === 'bytes') {
    return Buffer.from(arg, 'base64')
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
