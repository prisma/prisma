import {
  ColumnType,
  ColumnTypeEnum,
  // Debug
} from '@prisma/driver-adapter-utils'

// const debug = Debug('prisma:driver-adapter:d1:conversion')

export type Value = null | string | number | object

export function getColumnTypes(columnNames: string[], rows: Object[]): ColumnType[] {
  const columnTypes: (ColumnType | null)[] = []

  columnLoop: for (const columnIndex of columnNames) {
    // No declared column type in db schema, infer using first non-null value
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const candidateValue = rows[rowIndex][columnIndex]
      if (candidateValue !== null) {
        columnTypes[columnIndex] = inferColumnType(candidateValue)
        continue columnLoop
      }
    }

    // No non-null value found for this column, fall back to int32 to mimic what quaint does
    columnTypes[columnIndex] = ColumnTypeEnum.Int32
  }

  return columnTypes as ColumnType[]
}

// JavaScript	D1
// null	NULL
// Number	REAL
// Number 1	INTEGER
// String	TEXT
// Boolean 2	INTEGER
// ArrayBuffer	BLOB
// undefined	Not supported. Queries with undefined values will return a D1_TYPE_ERROR
//
// 1 D1 supports 64-bit signed INTEGER values internally, however BigInts
// are not currently supported in the API yet. JavaScript integers are safe up to Number.MAX_SAFE_INTEGER
//
// 2 Booleans will be cast to an INTEGER type where 1 is TRUE and 0 is FALSE.

function inferColumnType(value: NonNullable<Value>): ColumnType {
  switch (typeof value) {
    case 'string':
      return ColumnTypeEnum.Text
    // case 'bigint':
    //   return ColumnTypeEnum.Int64
    // case 'boolean':
    //   return ColumnTypeEnum.Boolean
    case 'number':
      return ColumnTypeEnum.UnknownNumber
    case 'object':
      return inferObjectType(value)
    default:
      throw new UnexpectedTypeError(value)
  }
}

function inferObjectType(value: {}): ColumnType {
  if (value instanceof Array) {
    return ColumnTypeEnum.Bytes
  }
  throw new UnexpectedTypeError(value)
}

class UnexpectedTypeError extends Error {
  name = 'UnexpectedTypeError'
  constructor(value: unknown) {
    const type = typeof value
    const repr = type === 'object' ? JSON.stringify(value) : String(value)
    super(`unexpected value of type ${type}: ${repr}`)
  }
}

// TODO
// export function mapRow(row: Row, columnTypes: ColumnType[]): unknown[] {
//   // `Row` doesn't have map, so we copy the array once and modify it in-place
//   // to avoid allocating and copying twice if we used `Array.from(row).map(...)`.
//   const result: unknown[] = Array.from(row)

//   for (let i = 0; i < result.length; i++) {
//     const value = result[i]

//     // Convert array buffers to arrays of bytes.
//     // Base64 would've been more efficient but would collide with the existing
//     // logic that treats string values of type Bytes as raw UTF-8 bytes that was
//     // implemented for other adapters.
//     if (value instanceof ArrayBuffer) {
//       result[i] = Array.from(new Uint8Array(value))
//       continue
//     }

//     // If an integer is required and the current number isn't one,
//     // discard the fractional part.
//     if (
//       typeof value === 'number' &&
//       (columnTypes[i] === ColumnTypeEnum.Int32 || columnTypes[i] === ColumnTypeEnum.Int64) &&
//       !Number.isInteger(value)
//     ) {
//       result[i] = Math.trunc(value)
//       continue
//     }

//     // Decode DateTime values saved as numeric timestamps which is the
//     // format used by the native quaint sqlite connector.
//     if (['number', 'bigint'].includes(typeof value) && columnTypes[i] === ColumnTypeEnum.DateTime) {
//       result[i] = new Date(Number(value)).toISOString()
//       continue
//     }

//     // Convert bigint to string as we can only use JSON-encodable types here.
//     if (typeof value === 'bigint') {
//       result[i] = value.toString()
//       continue
//     }
//   }

//   return result
// }
