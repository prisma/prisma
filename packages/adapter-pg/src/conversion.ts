import { type ColumnType, ColumnTypeEnum, JsonNullMarker } from '@prisma/driver-adapter-utils'
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
    case PgColumnType['MONEY']:
      return ColumnTypeEnum.Numeric
    case PgColumnType['JSONB']:
      return ColumnTypeEnum.Json
    case PgColumnType['UUID']:
      return ColumnTypeEnum.Uuid
    case PgColumnType['OID']:
      return ColumnTypeEnum.Int64
    case PgColumnType['BPCHAR']:
    case PgColumnType['TEXT']:
    case PgColumnType['VARCHAR']:
    case PgColumnType['BIT']:
    case PgColumnType['VARBIT']:
    case PgColumnType['INET']:
    case PgColumnType['CIDR']:
      return ColumnTypeEnum.Text
    default:
      if (fieldTypeId >= 10000) {
        // Postgres Custom Types
        return ColumnTypeEnum.Enum
      }
      throw new Error(`Unsupported column type: ${fieldTypeId}`)
  }
}

/**
 * JsonNull are stored in JSON strings as the string "null", distinguishable from
 * the `null` value which is used by the driver to represent the database NULL.
 * By default, JSON and JSONB columns use JSON.parse to parse a JSON column value
 * and this will lead to serde_json::Value::Null in Rust, which will be interpreted
 * as DbNull.
 *
 * By converting "null" to JsonNullMarker, we can signal JsonNull in Rust side and
 * convert it to QuaintValue::Json(Some(Null)).
 */
function convertJson(json: string): unknown {
  return json === 'null' ? JsonNullMarker : JSON.parse(json)
}

// return string instead of JavaScript Date object
types.setTypeParser(PgColumnType.TIME, (date) => date)
types.setTypeParser(PgColumnType.DATE, (date) => date)
types.setTypeParser(PgColumnType.TIMESTAMP, (date) => date)
types.setTypeParser(PgColumnType.JSONB, convertJson)
types.setTypeParser(PgColumnType.JSON, convertJson)
types.setTypeParser(PgColumnType.MONEY, (money: string) => money.slice(1))
