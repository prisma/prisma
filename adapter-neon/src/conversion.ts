import { ColumnTypeEnum, type ColumnType, JsonNullMarker } from '@prisma/driver-adapter-utils'
import { types } from '@neondatabase/serverless'
import { parse as parseArray } from 'postgres-array'

const ScalarColumnType = types.builtins

/**
 * PostgreSQL array column types (not defined in ScalarColumnType).
 * 
 * See the semantics of each of this code in:
 *   https://github.com/postgres/postgres/blob/master/src/include/catalog/pg_type.dat
 */
const ArrayColumnType = {
  BIT_ARRAY: 1561,
  BOOL_ARRAY: 1000,
  BYTEA_ARRAY: 1001,
  BPCHAR_ARRAY: 1014,
  CHAR_ARRAY: 1002,
  CIDR_ARRAY: 651,
  DATE_ARRAY: 1182,
  FLOAT4_ARRAY: 1021,
  FLOAT8_ARRAY: 1022,
  INET_ARRAY: 1041,
  INT2_ARRAY: 1005,
  INT4_ARRAY: 1007,
  INT8_ARRAY: 1016,
  JSONB_ARRAY: 3807,
  JSON_ARRAY: 199,
  MONEY_ARRAY: 791,
  NUMERIC_ARRAY: 1231,
  OID_ARRAY: 1028,
  TEXT_ARRAY: 1009,
  TIMESTAMP_ARRAY: 1115,
  TIME_ARRAY: 1183,
  UUID_ARRAY: 2951,
  VARBIT_ARRAY: 1563,
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
    case ScalarColumnType['INT2']:
    case ScalarColumnType['INT4']:
      return ColumnTypeEnum.Int32
    case ScalarColumnType['INT8']:
      return ColumnTypeEnum.Int64
    case ScalarColumnType['FLOAT4']:
      return ColumnTypeEnum.Float
    case ScalarColumnType['FLOAT8']:
      return ColumnTypeEnum.Double
    case ScalarColumnType['BOOL']:
      return ColumnTypeEnum.Boolean
    case ScalarColumnType['DATE']:
      return ColumnTypeEnum.Date
    case ScalarColumnType['TIME']:
    case ScalarColumnType['TIMETZ']:
      return ColumnTypeEnum.Time
    case ScalarColumnType['TIMESTAMP']:
    case ScalarColumnType['TIMESTAMPTZ']:
      return ColumnTypeEnum.DateTime
    case ScalarColumnType['NUMERIC']:
    case ScalarColumnType['MONEY']:
      return ColumnTypeEnum.Numeric
    case ScalarColumnType['JSON']:
    case ScalarColumnType['JSONB']:
      return ColumnTypeEnum.Json
    case ScalarColumnType['UUID']:
      return ColumnTypeEnum.Uuid
    case ScalarColumnType['OID']:
      return ColumnTypeEnum.Int64
    case ScalarColumnType['BPCHAR']:
    case ScalarColumnType['TEXT']:
    case ScalarColumnType['VARCHAR']:
    case ScalarColumnType['BIT']:
    case ScalarColumnType['VARBIT']:
    case ScalarColumnType['INET']:
    case ScalarColumnType['CIDR']:
    case ScalarColumnType['XML']:
      return ColumnTypeEnum.Text
    case ScalarColumnType['BYTEA']:
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
    case ArrayColumnType.BPCHAR_ARRAY:
    case ArrayColumnType.TEXT_ARRAY:
    case ArrayColumnType.VARCHAR_ARRAY:
    case ArrayColumnType.VARBIT_ARRAY:
    case ArrayColumnType.BIT_ARRAY:
    case ArrayColumnType.INET_ARRAY:
    case ArrayColumnType.CIDR_ARRAY:
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
    case ArrayColumnType.INT8_ARRAY:
    case ArrayColumnType.OID_ARRAY:
      return ColumnTypeEnum.Int64Array
    default:
      if (fieldTypeId >= 10000) {
        // Postgres Custom Types
        return ColumnTypeEnum.Enum
      }
      throw new Error(`Unsupported column type: ${fieldTypeId}`)
  }
}

function normalize_array(element_normalizer: (string) => string): (string) => string[] {
  return (str) => parseArray(str, element_normalizer)
}

/****************************/
/* Time-related data-types  */
/****************************/

function normalize_numeric(numeric: string): string {
  return numeric
}

types.setTypeParser(ScalarColumnType.NUMERIC, normalize_numeric)
types.setTypeParser(ArrayColumnType.NUMERIC_ARRAY, normalize_array(normalize_numeric))

/****************************/
/* Time-related data-types  */
/****************************/


function normalize_date(date: string): string {
  return date
}

function normalize_timestamp(time: string): string {
  return time
}

function normalize_timestampz(time: string): string {
  return time.split("+")[0]
}

/*
 * TIME, TIMETZ, TIME_ARRAY - converts value (or value elements) to a string in the format HH:mm:ss.f
 */

function normalize_time(time: string): string {
  return time
}

function normalize_timez(time: string): string {
  // Although it might be controversial, UTC is assumed in consistency with the behavior of rust postgres driver
  // in quaint. See quaint/src/connector/postgres/conversion.rs
  return time.split("+")[0]
}

types.setTypeParser(ScalarColumnType.TIME, normalize_time)
types.setTypeParser(ArrayColumnType.TIME_ARRAY, normalize_array(normalize_time))
types.setTypeParser(ScalarColumnType.TIMETZ, normalize_timez)

/*
 * DATE, DATE_ARRAY - converts value (or value elements) to a string in the format YYYY-MM-DD
 */

types.setTypeParser(ScalarColumnType.DATE, normalize_date)
types.setTypeParser(ArrayColumnType.DATE_ARRAY, normalize_array(normalize_date))


/*
 * TIMESTAMP, TIMESTAMP_ARRAY - converts value (or value elements) to a string in the rfc3339 format
 * ex: 1996-12-19T16:39:57-08:00
 */
types.setTypeParser(ScalarColumnType.TIMESTAMP, normalize_timestamp)
types.setTypeParser(ArrayColumnType.TIMESTAMP_ARRAY, normalize_array(normalize_timestamp))
types.setTypeParser(ScalarColumnType.TIMESTAMPTZ, normalize_timestampz)

/******************/
/* Money handling */
/******************/

function normalize_money(money: string): string {
  return money.slice(1)
}

types.setTypeParser(ScalarColumnType.MONEY, normalize_money)
types.setTypeParser(ArrayColumnType.MONEY_ARRAY, normalize_array(normalize_money))


/*****************/
/* JSON handling */
/*****************/

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
function toJson(json: string): unknown {
  return (json === 'null') ? JsonNullMarker : JSON.parse(json)
}


types.setTypeParser(ScalarColumnType.JSONB, toJson)
types.setTypeParser(ScalarColumnType.JSON, toJson)

/************************/
/* Binary data handling */
/************************/

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

/*
 * BYTEA - arbitrary raw binary strings
 */

const parsePgBytes = types.getTypeParser(ScalarColumnType.BYTEA) as (_: string) => Buffer
/**
 * Convert bytes to a JSON-encodable representation since we can't
 * currently send a parsed Buffer or ArrayBuffer across JS to Rust
 * boundary.
 */
function convertBytes(serializedBytes: string): number[] {
  const buffer = parsePgBytes(serializedBytes)
  return encodeBuffer(buffer)
}

types.setTypeParser(ScalarColumnType.BYTEA, convertBytes)

/*
 * BYTEA_ARRAY - arrays of arbitrary raw binary strings
 */

const parseBytesArray = types.getTypeParser(ArrayColumnType.BYTEA_ARRAY) as (_: string) => Buffer[]

types.setTypeParser(ArrayColumnType.BYTEA_ARRAY, (serializedBytesArray) => {
  const buffers = parseBytesArray(serializedBytesArray)
  return buffers.map((buf) => buf ? encodeBuffer(buf) : null)
})

/* BIT_ARRAY, VARBIT_ARRAY */

function normalizeBit(bit: string): string {
  return bit
}

types.setTypeParser(ArrayColumnType.BIT_ARRAY, normalize_array(normalizeBit))
types.setTypeParser(ArrayColumnType.VARBIT_ARRAY, normalize_array(normalizeBit))