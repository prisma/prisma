import { ColumnTypeEnum, ColumnType, Debug } from '@prisma/driver-adapter-utils'
import { Row, Value } from '@libsql/client'
import { isArrayBuffer } from 'node:util/types'

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
    default:
      debug('unknown decltype:', declType)
      return null
  }
}

function mapDeclaredColumnTypes(columntTypes: string[]): [out: Array<ColumnType | null>, empty: Set<number>] {
  const emptyIndices = new Set<number>()
  const result = columntTypes.map((typeName, index) => {
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
      return inferNumericType(value)
    case 'object':
      return inferObjectType(value)
    default:
      throw new UnexpectedTypeError(value)
  }
}

function inferNumericType(value: number): ColumnType {
  if (Number.isInteger(value)) {
    return ColumnTypeEnum.Int64
  } else {
    return ColumnTypeEnum.Double
  }
}

function inferObjectType(value: {}): ColumnType {
  if (isArrayBuffer(value)) {
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

export function mapRow(row: Row): unknown[] {
  // `Row` doesn't have map, so we copy the array once and modify it in-place
  // to avoid allocating and copying twice if we used `Array.from(row).map(...)`.
  const result: unknown[] = Array.from(row)

  for (let i = 0; i < result.length; i++) {
    const value = result[i]

    // Convert bigint to string as we can only use JSON-encodable types here
    if (typeof value === 'bigint') {
      result[i] = value.toString()
    }

    // Convert array buffers to arrays of bytes.
    // Base64 would've been more efficient but would collide with the existing
    // logic that treats string values of type Bytes as raw UTF-8 bytes that was
    // implemented for other adapters.
    if (isArrayBuffer(value)) {
      result[i] = Array.from(new Uint8Array(value))
    }
  }

  return result
}
