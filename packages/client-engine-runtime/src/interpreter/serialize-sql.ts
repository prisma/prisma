import { type ColumnType, ColumnTypeEnum, type SqlResultSet } from '@prisma/driver-adapter-utils'

import { assertNever } from '../utils'

export function serializeSql(resultSet: SqlResultSet): Record<string, unknown>[] {
  const rows = resultSet.rows
  const columnNames = resultSet.columnNames
  const result = new Array<Record<string, unknown>>(rows.length)

  switch (columnNames.length) {
    case 0:
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        result[rowIndex] = {}
      }
      return result

    case 1: {
      const column0 = columnNames[0]
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex]
        const mappedRow: Record<string, unknown> = {}
        mappedRow[column0] = row[0]
        result[rowIndex] = mappedRow
      }
      return result
    }

    case 2: {
      const column0 = columnNames[0]
      const column1 = columnNames[1]
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex]
        const mappedRow: Record<string, unknown> = {}
        mappedRow[column0] = row[0]
        mappedRow[column1] = row[1]
        result[rowIndex] = mappedRow
      }
      return result
    }

    case 3: {
      const column0 = columnNames[0]
      const column1 = columnNames[1]
      const column2 = columnNames[2]
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex]
        const mappedRow: Record<string, unknown> = {}
        mappedRow[column0] = row[0]
        mappedRow[column1] = row[1]
        mappedRow[column2] = row[2]
        result[rowIndex] = mappedRow
      }
      return result
    }

    case 4: {
      const column0 = columnNames[0]
      const column1 = columnNames[1]
      const column2 = columnNames[2]
      const column3 = columnNames[3]
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex]
        const mappedRow: Record<string, unknown> = {}
        mappedRow[column0] = row[0]
        mappedRow[column1] = row[1]
        mappedRow[column2] = row[2]
        mappedRow[column3] = row[3]
        result[rowIndex] = mappedRow
      }
      return result
    }

    case 5: {
      const column0 = columnNames[0]
      const column1 = columnNames[1]
      const column2 = columnNames[2]
      const column3 = columnNames[3]
      const column4 = columnNames[4]
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex]
        const mappedRow: Record<string, unknown> = {}
        mappedRow[column0] = row[0]
        mappedRow[column1] = row[1]
        mappedRow[column2] = row[2]
        mappedRow[column3] = row[3]
        mappedRow[column4] = row[4]
        result[rowIndex] = mappedRow
      }
      return result
    }

    case 11: {
      const column0 = columnNames[0]
      const column1 = columnNames[1]
      const column2 = columnNames[2]
      const column3 = columnNames[3]
      const column4 = columnNames[4]
      const column5 = columnNames[5]
      const column6 = columnNames[6]
      const column7 = columnNames[7]
      const column8 = columnNames[8]
      const column9 = columnNames[9]
      const column10 = columnNames[10]
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex]
        const mappedRow: Record<string, unknown> = {}
        mappedRow[column0] = row[0]
        mappedRow[column1] = row[1]
        mappedRow[column2] = row[2]
        mappedRow[column3] = row[3]
        mappedRow[column4] = row[4]
        mappedRow[column5] = row[5]
        mappedRow[column6] = row[6]
        mappedRow[column7] = row[7]
        mappedRow[column8] = row[8]
        mappedRow[column9] = row[9]
        mappedRow[column10] = row[10]
        result[rowIndex] = mappedRow
      }
      return result
    }
  }

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]
    const mappedRow: Record<string, unknown> = {}
    for (let columnIndex = 0; columnIndex < columnNames.length; columnIndex++) {
      mappedRow[columnNames[columnIndex]] = row[columnIndex]
    }

    result[rowIndex] = mappedRow
  }

  return result
}

export function serializeRawSql(resultSet: SqlResultSet): Record<string, unknown> {
  return {
    columns: resultSet.columnNames,
    types: resultSet.columnTypes.map((type) => serializeColumnType(type)),
    rows: resultSet.rows.map((row) =>
      row.map((value, index) => serializeRawValue(value, resultSet.columnTypes[index])),
    ),
  }
}

function serializeRawValue(value: unknown, type: ColumnType): unknown {
  if (value === null) {
    return null
  }

  switch (type) {
    case ColumnTypeEnum.Int32:
      switch (typeof value) {
        case 'number':
          return Math.trunc(value)
        case 'string':
          return Math.trunc(Number(value))
        default:
          throw new Error(`Cannot serialize value of type ${typeof value} as Int32`)
      }

    case ColumnTypeEnum.Int32Array:
      if (!Array.isArray(value)) {
        throw new Error(`Cannot serialize value of type ${typeof value} as Int32Array`)
      }
      return value.map((v) => serializeRawValue(v, ColumnTypeEnum.Int32))

    case ColumnTypeEnum.Int64:
      switch (typeof value) {
        case 'number':
          return BigInt(Math.trunc(value))
        case 'string':
          return value
        default:
          throw new Error(`Cannot serialize value of type ${typeof value} as Int64`)
      }

    case ColumnTypeEnum.Int64Array:
      if (!Array.isArray(value)) {
        throw new Error(`Cannot serialize value of type ${typeof value} as Int64Array`)
      }
      return value.map((v) => serializeRawValue(v, ColumnTypeEnum.Int64))

    case ColumnTypeEnum.Json:
      switch (typeof value) {
        case 'string':
          return JSON.parse(value)
        default:
          throw new Error(`Cannot serialize value of type ${typeof value} as Json`)
      }

    case ColumnTypeEnum.JsonArray:
      if (!Array.isArray(value)) {
        throw new Error(`Cannot serialize value of type ${typeof value} as JsonArray`)
      }
      return value.map((v) => serializeRawValue(v, ColumnTypeEnum.Json))

    case ColumnTypeEnum.Boolean:
      switch (typeof value) {
        case 'boolean':
          return value
        case 'string':
          return value === 'true' || value === '1'
        case 'number':
          return value === 1
        default:
          throw new Error(`Cannot serialize value of type ${typeof value} as Boolean`)
      }

    case ColumnTypeEnum.BooleanArray:
      if (!Array.isArray(value)) {
        throw new Error(`Cannot serialize value of type ${typeof value} as BooleanArray`)
      }
      return value.map((v) => serializeRawValue(v, ColumnTypeEnum.Boolean))

    default:
      return value // For all other types, return the value as is
  }
}

// maps JS column types to their Rust equivalents
function serializeColumnType(columnType: ColumnType): string {
  switch (columnType) {
    case ColumnTypeEnum.Int32:
      return 'int'
    case ColumnTypeEnum.Int64:
      return 'bigint'
    case ColumnTypeEnum.Float:
      return 'float'
    case ColumnTypeEnum.Double:
      return 'double'
    case ColumnTypeEnum.Text:
      return 'string'
    case ColumnTypeEnum.Enum:
      return 'enum'
    case ColumnTypeEnum.Bytes:
      return 'bytes'
    case ColumnTypeEnum.Boolean:
      return 'bool'
    case ColumnTypeEnum.Character:
      return 'char'
    case ColumnTypeEnum.Numeric:
      return 'decimal'
    case ColumnTypeEnum.Json:
      return 'json'
    case ColumnTypeEnum.Uuid:
      return 'uuid'
    case ColumnTypeEnum.DateTime:
      return 'datetime'
    case ColumnTypeEnum.Date:
      return 'date'
    case ColumnTypeEnum.Time:
      return 'time'
    case ColumnTypeEnum.Int32Array:
      return 'int-array'
    case ColumnTypeEnum.Int64Array:
      return 'bigint-array'
    case ColumnTypeEnum.FloatArray:
      return 'float-array'
    case ColumnTypeEnum.DoubleArray:
      return 'double-array'
    case ColumnTypeEnum.TextArray:
      return 'string-array'
    case ColumnTypeEnum.EnumArray:
      return 'string-array'
    case ColumnTypeEnum.BytesArray:
      return 'bytes-array'
    case ColumnTypeEnum.BooleanArray:
      return 'bool-array'
    case ColumnTypeEnum.CharacterArray:
      return 'char-array'
    case ColumnTypeEnum.NumericArray:
      return 'decimal-array'
    case ColumnTypeEnum.JsonArray:
      return 'json-array'
    case ColumnTypeEnum.UuidArray:
      return 'uuid-array'
    case ColumnTypeEnum.DateTimeArray:
      return 'datetime-array'
    case ColumnTypeEnum.DateArray:
      return 'date-array'
    case ColumnTypeEnum.TimeArray:
      return 'time-array'
    case ColumnTypeEnum.UnknownNumber:
      return 'unknown'
    /// The following PlanetScale type IDs are mapped into Set:
    /// - SET (SET) -> e.g. `"foo,bar"` (String-encoded, comma-separated)
    case ColumnTypeEnum.Set:
      return 'string'
    default:
      assertNever(columnType, `Unexpected column type: ${columnType}`)
  }
}
