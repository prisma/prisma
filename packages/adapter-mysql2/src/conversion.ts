import { type ColumnType, ColumnTypeEnum } from '@prisma/driver-adapter-utils'

export type MySQLColumnType = keyof typeof typeNames | (number & {})

// map of type codes to type names
const typeNames = {
  0x00: 'DECIMAL', // aka DECIMAL
  0x01: 'TINY', // aka TINYINT, 1 byte
  0x02: 'SHORT', // aka SMALLINT, 2 bytes
  0x03: 'LONG', // aka INT, 4 bytes
  0x04: 'FLOAT', // aka FLOAT, 4-8 bytes
  0x05: 'DOUBLE', // aka DOUBLE, 8 bytes
  0x06: 'NULL', // NULL (used for prepared statements, I think)
  0x07: 'TIMESTAMP', // aka TIMESTAMP
  0x08: 'LONGLONG', // aka BIGINT, 8 bytes
  0x09: 'INT24', // aka MEDIUMINT, 3 bytes
  0x0a: 'DATE', // aka DATE
  0x0b: 'TIME', // aka TIME
  0x0c: 'DATETIME', // aka DATETIME
  0x0d: 'YEAR', // aka YEAR, 1 byte (don't ask)
  0x0e: 'NEWDATE', // aka ?
  0x0f: 'VARCHAR', // aka VARCHAR (?)
  0x10: 'BIT', // aka BIT, 1-8 byte
  0xf5: 'JSON',
  0xf6: 'NEWDECIMAL', // aka DECIMAL
  0xf7: 'ENUM', // aka ENUM
  0xf8: 'SET', // aka SET
  0xf9: 'TINY_BLOB', // aka TINYBLOB, TINYTEXT
  0xfa: 'MEDIUM_BLOB', // aka MEDIUMBLOB, MEDIUMTEXT
  0xfb: 'LONG_BLOB', // aka LONGBLOG, LONGTEXT
  0xfc: 'BLOB', // aka BLOB, TEXT
  0xfd: 'VAR_STRING', // aka VARCHAR, VARBINARY
  0xfe: 'STRING', // aka CHAR, BINARY
  0xff: 'GEOMETRY', // aka GEOMETRY
} as const

export class UnsupportedNativeDataType extends Error {
  type: string

  constructor(code: number) {
    super()
    this.type = typeNames[code] || 'Unknown'
    this.message = `Unsupported column type ${this.type}`
  }
}

/**
 * This is a simplification of quaint's value inference logic. Take a look at quaint's conversion.rs
 * module to see how other attributes of the field packet such as the field length are used to infer
 * the correct quaint::Value variant.
 */
export function fieldToColumnType(fieldTypeIdx?: number): ColumnType {
  const fieldType = fieldTypeIdx !== undefined ? typeNames[fieldTypeIdx as keyof typeof typeNames] : undefined

  switch (fieldType) {
    case 'TINY':
    case 'SHORT':
    case 'LONG':
    case 'INT24':
    case 'YEAR':
      return ColumnTypeEnum.Int32
    case 'LONGLONG':
      return ColumnTypeEnum.Int64
    case 'FLOAT':
      return ColumnTypeEnum.Float
    case 'DOUBLE':
      return ColumnTypeEnum.Double
    case 'TIMESTAMP':
    case 'DATETIME':
      return ColumnTypeEnum.DateTime
    case 'DATE':
      return ColumnTypeEnum.Date
    case 'TIME':
      return ColumnTypeEnum.Time
    case 'DECIMAL':
    case 'NEWDECIMAL':
      return ColumnTypeEnum.Numeric
    case 'STRING':
    case 'VARCHAR':
    case 'VAR_STRING':
      return ColumnTypeEnum.Text
    case 'ENUM':
      return ColumnTypeEnum.Enum
    case 'JSON':
      return ColumnTypeEnum.Json
    case 'BLOB':
    case 'TINY_BLOB':
    case 'MEDIUM_BLOB':
    case 'LONG_BLOB':
    case 'BIT':
    case 'GEOMETRY':
      return ColumnTypeEnum.Bytes
    case 'NULL':
      // Fall back to Int32 for consistency with quaint.
      return ColumnTypeEnum.Int32
    default:
      throw new Error(`Unsupported column type: ${fieldTypeIdx}`)
  }
}

export function mapArg(arg: unknown): unknown {
  if (arg instanceof Uint8Array) {
    return Buffer.from(arg)
  }
  if (typeof arg === 'bigint') {
    if (arg >= BigInt(Number.MIN_SAFE_INTEGER) && arg <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(arg)
    }
    return arg.toString()
  }
  return arg
}

export const mapRow =
  (columnTypes: ColumnType[]) =>
  (row: unknown[]): unknown[] => {
    const result: unknown[] = Array.from(row)

    for (let i = 0; i < result.length; i++) {
      const value = result[i]

      // Convert array buffers to arrays of bytes.
      // Base64 would've been more efficient but would collide with the existing
      // logic that treats string values of type Bytes as raw UTF-8 bytes that was
      // implemented for other adapters.
      if (value instanceof ArrayBuffer) {
        result[i] = Array.from(new Uint8Array(value))
        continue
      }

      if (value instanceof Uint8Array) {
        result[i] = Array.from(value)
        continue
      }

      // Decode DateTime values saved as numeric timestamps which is the
      // format used by the native quaint sqlite connector.
      if (['number', 'bigint'].includes(typeof value) && columnTypes[i] === ColumnTypeEnum.DateTime) {
        result[i] = new Date(Number(value)).toISOString()
        continue
      }
    }

    return result
  }
