import { ColumnTypeEnum, type ColumnType, JsonNullMarker } from '@prisma/driver-adapter-utils'
import { types } from '@neondatabase/serverless'

const NeonColumnType = types.builtins

/**
 * This is a simplification of quaint's value inference logic. Take a look at quaint's conversion.rs
 * module to see how other attributes of the field packet such as the field length are used to infer
 * the correct quaint::Value variant.
 */
export function fieldToColumnType(fieldTypeId: number): ColumnType {
  switch (fieldTypeId) {
    case NeonColumnType['INT2']:
    case NeonColumnType['INT4']:
      return ColumnTypeEnum.Int32
    case NeonColumnType['INT8']:
      return ColumnTypeEnum.Int64
    case NeonColumnType['FLOAT4']:
      return ColumnTypeEnum.Float
    case NeonColumnType['FLOAT8']:
      return ColumnTypeEnum.Double
    case NeonColumnType['BOOL']:
      return ColumnTypeEnum.Boolean
    case NeonColumnType['DATE']:
      return ColumnTypeEnum.Date
    case NeonColumnType['TIME']:
      return ColumnTypeEnum.Time
    case NeonColumnType['TIMESTAMP']:
      return ColumnTypeEnum.DateTime
    case NeonColumnType['NUMERIC']:
    case NeonColumnType['MONEY']:
      return ColumnTypeEnum.Numeric
    case NeonColumnType['JSONB']:
      return ColumnTypeEnum.Json
    case NeonColumnType['UUID']:
      return ColumnTypeEnum.Uuid
    case NeonColumnType['OID']:
      return ColumnTypeEnum.Int64
    case NeonColumnType['BPCHAR']:
    case NeonColumnType['TEXT']:
    case NeonColumnType['VARCHAR']:
    case NeonColumnType['BIT']:
    case NeonColumnType['VARBIT']:
    case NeonColumnType['INET']:
    case NeonColumnType['CIDR']:
      return ColumnTypeEnum.Text
    case NeonColumnType['BYTEA']:
      return ColumnTypeEnum.Bytes
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
  return (json === 'null') ? JsonNullMarker : JSON.parse(json)
}

// Original BYTEA parser
const parsePgBytes = types.getTypeParser(NeonColumnType.BYTEA) as (_: string) => Buffer

/**
 * Convert bytes to a JSON-encodable representation since we can't
 * currently send a parsed Buffer or ArrayBuffer across JS to Rust
 * boundary.
 * TODO:
 * 1. Check if using base64 would be more efficient than this encoding.
 * 2. Consider the possibility of eliminating re-encoding altogether
 *    and passing bytea hex format to the engine if that can be aligned
 *    with other adapter flavours.
 */
function convertBytes(serializedBytes: string): number[] {
  const buffer = parsePgBytes(serializedBytes)
  return Array.from(new Uint8Array(buffer))
}

// return string instead of JavaScript Date object
types.setTypeParser(NeonColumnType.TIME, date => date)
types.setTypeParser(NeonColumnType.DATE, date => date)
types.setTypeParser(NeonColumnType.TIMESTAMP, date => date)
types.setTypeParser(NeonColumnType.JSONB, convertJson)
types.setTypeParser(NeonColumnType.JSON, convertJson)
types.setTypeParser(NeonColumnType.MONEY, money => money.slice(1))
types.setTypeParser(NeonColumnType.BYTEA, convertBytes)
