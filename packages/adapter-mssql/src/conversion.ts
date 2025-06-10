import { ColumnType, ColumnTypeEnum, DriverAdapterError, IsolationLevel } from '@prisma/driver-adapter-utils'
import * as sql from 'mssql'

export function mapColumnType(col: sql.IColumn): ColumnType {
  switch (col.type) {
    case sql.VarChar:
    case sql.Char:
    case sql.NVarChar:
    case sql.NChar:
    case sql.Text:
    case sql.NText:
    case sql.Xml:
      return ColumnTypeEnum.Text

    case sql.Bit:
      return ColumnTypeEnum.Boolean

    case sql.TinyInt:
    case sql.SmallInt:
    case sql.Int:
      return ColumnTypeEnum.Int32

    case sql.BigInt:
      return ColumnTypeEnum.Int64

    case sql.DateTime2:
    case sql.SmallDateTime:
    case sql.DateTime:
    case sql.DateTimeOffset:
      return ColumnTypeEnum.DateTime

    case sql.Real:
      return ColumnTypeEnum.Float

    case sql.Float:
    case sql.Money:
    case sql.SmallMoney:
      return ColumnTypeEnum.Double

    case sql.UniqueIdentifier:
      return ColumnTypeEnum.Uuid

    case sql.Decimal:
    case sql.Numeric:
      return ColumnTypeEnum.Numeric

    case sql.Date:
      return ColumnTypeEnum.Date

    case sql.Time:
      return ColumnTypeEnum.Time

    case sql.VarBinary:
    case sql.Binary:
    case sql.Image:
      return ColumnTypeEnum.Bytes

    default:
      throw new DriverAdapterError({
        kind: 'UnsupportedNativeDataType',
        type: `${col.type['constructor'].name}`,
      })
  }
}

export function mapIsolationLevel(level: IsolationLevel): sql.IIsolationLevel {
  switch (level) {
    case 'READ COMMITTED':
      return sql.ISOLATION_LEVEL.READ_COMMITTED
    case 'READ UNCOMMITTED':
      return sql.ISOLATION_LEVEL.READ_UNCOMMITTED
    case 'REPEATABLE READ':
      return sql.ISOLATION_LEVEL.REPEATABLE_READ
    case 'SERIALIZABLE':
      return sql.ISOLATION_LEVEL.SERIALIZABLE
    case 'SNAPSHOT':
      return sql.ISOLATION_LEVEL.SNAPSHOT
    default:
      throw new DriverAdapterError({
        kind: 'InvalidIsolationLevel',
        level,
      })
  }
}

export function mapRow(row: unknown[]): unknown[] {
  return row.map((value) => {
    if (value instanceof Date) {
      return value.toISOString()
    }

    if (Buffer.isBuffer(value)) {
      return Array.from(value)
    }

    return value
  })
}
