import { ColumnTypeEnum, type ColumnType, JsonNullMarker } from '@prisma/driver-adapter-utils'
import { types } from '@neondatabase/serverless'

const NeonColumnType = types.builtins

/**
 * PostgreSQL array column types (not defined in NeonColumnType).
 */
const ArrayColumnType = {
  BOOL_ARRAY: 1000,
  BYTEA_ARRAY: 1001,
  BPCHAR_ARRAY: 1014,
  CHAR_ARRAY: 1002,
  DATE_ARRAY: 1182,
  FLOAT4_ARRAY: 1021,
  FLOAT8_ARRAY: 1022,
  INT2_ARRAY: 1005,
  INT4_ARRAY: 1007,
  JSONB_ARRAY: 3807,
  JSON_ARRAY: 199,
  MONEY_ARRAY: 791,
  NUMERIC_ARRAY: 1231,
  TEXT_ARRAY: 1009,
  TIMESTAMP_ARRAY: 1115,
  TIME_ARRAY: 1183,
  UUID_ARRAY: 2951,
  VARCHAR_ARRAY: 1015,
  XML_ARRAY: 143,
}

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
    case NeonColumnType['JSON']:
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
    case NeonColumnType['XML']:
      return ColumnTypeEnum.Text
    case NeonColumnType['BYTEA']:
      return ColumnTypeEnum.Bytes

    case ArrayColumnType.INT2_ARRAY:
    case ArrayColumnType.INT4_ARRAY:
      return ColumnTypeEnum.Int32Array
    case ArrayColumnType.FLOAT4_ARRAY:
      return ColumnTypeEnum.FloatArray
    case ArrayColumnType.FLOAT8_ARRAY:
      return ColumnTypeEnum.DoubleArray
    case ArrayColumnType.NUMERIC_ARRAY:
    case ArrayColumnType.MONEY_ARRAY:
      return ColumnTypeEnum.NumericArray
    case ArrayColumnType.BOOL_ARRAY:
      return ColumnTypeEnum.BooleanArray
    case ArrayColumnType.CHAR_ARRAY:
      return ColumnTypeEnum.CharArray
    case ArrayColumnType.TEXT_ARRAY:
    case ArrayColumnType.VARCHAR_ARRAY:
    case ArrayColumnType.BPCHAR_ARRAY:
    case ArrayColumnType.XML_ARRAY:
      return ColumnTypeEnum.TextArray
    case ArrayColumnType.DATE_ARRAY:
      return ColumnTypeEnum.DateArray
    case ArrayColumnType.TIME_ARRAY:
      return ColumnTypeEnum.TimeArray
    case ArrayColumnType.TIMESTAMP_ARRAY:
      return ColumnTypeEnum.DateTimeArray
    case ArrayColumnType.JSON_ARRAY:
    case ArrayColumnType.JSONB_ARRAY:
      return ColumnTypeEnum.JsonArray
    case ArrayColumnType.BYTEA_ARRAY:
      return ColumnTypeEnum.BytesArray
    case ArrayColumnType.UUID_ARRAY:
      return ColumnTypeEnum.UuidArray

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
 */
function convertBytes(serializedBytes: string): number[] {
  const buffer = parsePgBytes(serializedBytes)
  return encodeBuffer(buffer)
}

/**
 * TODO:
 * 1. Check if using base64 would be more efficient than this encoding.
 * 2. Consider the possibility of eliminating re-encoding altogether
 *    and passing bytea hex format to the engine if that can be aligned
 *    with other adapter flavours.
 */
function encodeBuffer(buffer: Buffer) {
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

const parseBytesArray = types.getTypeParser(ArrayColumnType.BYTEA_ARRAY) as (_: string) => Buffer[]

types.setTypeParser(ArrayColumnType.BYTEA_ARRAY, (serializedBytesArray) => {
  const buffers = parseBytesArray(serializedBytesArray)
  return buffers.map(encodeBuffer)
})

const parseTextArray = types.getTypeParser(ArrayColumnType.TEXT_ARRAY) as (_: string) => string[]

types.setTypeParser(ArrayColumnType.TIME_ARRAY, parseTextArray)
types.setTypeParser(ArrayColumnType.DATE_ARRAY, parseTextArray)
types.setTypeParser(ArrayColumnType.TIMESTAMP_ARRAY, parseTextArray)

types.setTypeParser(ArrayColumnType.MONEY_ARRAY, (moneyArray) =>
  parseTextArray(moneyArray).map((money) => money.slice(1)),
)
