import { ColumnTypeEnum, type ColumnType } from '@jkomyno/prisma-driver-adapter-utils'
import { types } from 'pg'

const PgColumnType = types.builtins

/**
 * This is a simplification of quaint's value inference logic. Take a look at quaint's conversion.rs
 * module to see how other attributes of the field packet such as the field length are used to infer
 * the correct quaint::Value variant.
 */
export function fieldToColumnType(fieldTypeId: number): ColumnType {
  switch (fieldTypeId) {
    case PgColumnType['INT2']:
    case PgColumnType['INT4']:
      return ColumnTypeEnum.Int32
    case PgColumnType['INT8']:
      return ColumnTypeEnum.Int64
    case PgColumnType['FLOAT4']:
      return ColumnTypeEnum.Float
    case PgColumnType['FLOAT8']:
      return ColumnTypeEnum.Double
    case PgColumnType['BOOL']:
      return ColumnTypeEnum.Boolean
    case PgColumnType['DATE']:
      return ColumnTypeEnum.Date
    case PgColumnType['TIME']:
      return ColumnTypeEnum.Time
    case PgColumnType['TIMESTAMP']:
      return ColumnTypeEnum.DateTime
    case PgColumnType['NUMERIC']:
      return ColumnTypeEnum.Numeric
    case PgColumnType['BPCHAR']:
      return ColumnTypeEnum.Char
    case PgColumnType['TEXT']:
    case PgColumnType['VARCHAR']:
      return ColumnTypeEnum.Text
    case PgColumnType['JSONB']:
      return ColumnTypeEnum.Json
    default:
      if (fieldTypeId >= 10000) {
        // Postgres Custom Types
        return ColumnTypeEnum.Enum
      }
      throw new Error(`Unsupported column type: ${fieldTypeId}`)
  }
}

// return string instead of JavaScript Date object
types.setTypeParser(PgColumnType.DATE, date => date)
types.setTypeParser(PgColumnType.TIME, date => date)
types.setTypeParser(PgColumnType.TIMESTAMP, date => date)
