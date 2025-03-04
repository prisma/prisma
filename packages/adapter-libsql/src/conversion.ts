import type { Row, Value } from '@libsql/client'
import { type ColumnType, ColumnTypeEnum, Debug } from '@prisma/driver-adapter-utils'

const debug = Debug('prisma:driver-adapter:libsql:conversion')

// Mirrors sqlite/conversion.rs in quaint
function mapDeclType(declType: string): ColumnType | null {
  switch (declType.toUpperCase()) {
    case '':
      return null
    case 'DECIMAL':
      return ColumnTypeEnum.Numeric
    case 'FLOAT':
      return ColumnTypeEnum.Float
    case 'DOUBLE':
    case 'DOUBLE PRECISION':
    case 'NUMERIC':
    case 'REAL':
      return ColumnTypeEnum.Double
    case 'TINYINT':
    case 'SMALLINT':
    case 'MEDIUMINT':
    case 'INT':
    case 'INTEGER':
    case 'SERIAL':
    case 'INT2':
      return ColumnTypeEnum.Int32
    case 'BIGINT':
    case 'UNSIGNED BIG INT':
    case 'INT8':
      return ColumnTypeEnum.Int64
    case 'DATETIME':
    case 'TIMESTAMP':
      return ColumnTypeEnum.DateTime
    case 'TIME':
      return ColumnTypeEnum.Time
    case 'DATE':
      return ColumnTypeEnum.Date
    case 'TEXT':
    case 'CLOB':
    case 'CHARACTER':
    case 'VARCHAR':
    case 'VARYING CHARACTER':
    case 'NCHAR':
    case 'NATIVE CHARACTER':
    case 'NVARCHAR':
      return ColumnTypeEnum.Text
    case 'BLOB':
      return ColumnTypeEnum.Bytes
    case 'BOOLEAN':
      return ColumnTypeEnum.Boolean
    case 'JSONB':
      return ColumnTypeEnum.Json
    default:
      debug('unknown decltype:', declType)
      return null
  }
}

function mapDeclaredColumnTypes(columnTypes: string[]): [out: Array<ColumnType | null>, empty: Set<number>] {
  const emptyIndices = new Set<number>()
  const result = columnTypes.map((typeName, index) => {
    const mappedType = mapDeclType(typeName)
    if (mappedType === null) {
      emptyIndices.add(index)
    }
    return mappedType
  })
  return [result, emptyIndices]
}

export function getColumnTypes(declaredTypes: string[], rows: Row[]): ColumnType[] {
  const [columnTypes, emptyIndices] = mapDeclaredColumnTypes(declaredTypes)

  if (emptyIndices.size === 0) {
    return columnTypes as ColumnType[]
  }

  columnLoop: for (const columnIndex of emptyIndices) {
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

function inferColumnType(value: NonNullable<Value>): ColumnType {
  switch (typeof value) {
    case 'string':
      return ColumnTypeEnum.Text
    case 'bigint':
      return ColumnTypeEnum.Int64
    case 'boolean':
      return ColumnTypeEnum.Boolean
    case 'number':
      return ColumnTypeEnum.UnknownNumber
    case 'object':
      return inferObjectType(value)
    default:
      throw new UnexpectedTypeError(value)
  }
}

function inferObjectType(value: {}): ColumnType {
  if (value instanceof ArrayBuffer) {
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

export function mapRow(row: Row, columnTypes: ColumnType[]): unknown[] {
  // `Row` doesn't have map, so we copy the array once and modify it in-place
  // to avoid allocating and copying twice if we used `Array.from(row).map(...)`.
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

    // If an integer is required and the current number isn't one,
    // discard the fractional part.
    if (
      typeof value === 'number' &&
      (columnTypes[i] === ColumnTypeEnum.Int32 || columnTypes[i] === ColumnTypeEnum.Int64) &&
      !Number.isInteger(value)
    ) {
      result[i] = Math.trunc(value)
      continue
    }

    // Decode DateTime values saved as numeric timestamps which is the
    // format used by the native quaint sqlite connector.
    if (['number', 'bigint'].includes(typeof value) && columnTypes[i] === ColumnTypeEnum.DateTime) {
      result[i] = new Date(Number(value)).toISOString()
      continue
    }

    // Convert bigint to string as we can only use JSON-encodable types here.
    if (typeof value === 'bigint') {
      result[i] = value.toString()
    }
  }

  return result
}
