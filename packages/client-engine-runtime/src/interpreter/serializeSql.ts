import { type ColumnType, ColumnTypeEnum, type SqlResultSet } from '@prisma/driver-adapter-utils'

import { assertNever } from '../utils'

export function serializeSql(resultSet: SqlResultSet): Record<string, unknown>[] {
  return resultSet.rows.map((row) =>
    row.reduce<Record<string, unknown>>((acc, value, index) => {
      const splitByDot = resultSet.columnNames[index].split('.')

      let nested: {} = acc
      for (let i = 0; i < splitByDot.length; i++) {
        const key = splitByDot[i]
        if (i === splitByDot.length - 1) {
          nested[key] = value
        } else {
          if (nested[key] === undefined) {
            nested[key] = {}
          }
          nested = nested[key]
        }
      }
      return acc
    }, {}),
  )
}

export function serializeRawSql(resultSet: SqlResultSet): Record<string, unknown> {
  return {
    columns: resultSet.columnNames,
    types: resultSet.columnTypes.map((type) => serializeColumnType(type)),
    rows: resultSet.rows,
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
