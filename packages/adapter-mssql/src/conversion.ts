import { ColumnType, ColumnTypeEnum, DriverAdapterError, IsolationLevel } from '@prisma/driver-adapter-utils'
import sql from 'mssql'

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
        type: col['udt']?.name ?? 'N/A',
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

export function mapArg(arg: unknown): unknown {
  if (arg instanceof Uint8Array) {
    return Buffer.from(arg)
  }
  if (typeof arg === 'bigint') {
    if (arg >= BigInt(Number.MIN_SAFE_INTEGER) && arg <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(arg)
    }
    return arg.toString()
  }
  return arg
}

export function mapRow(row: unknown[], columns?: sql.columns): unknown[] {
  return row.map((value, i) => {
    if (value instanceof Date) {
      if (columns?.[i]?.type === sql.Time) {
        return value.toISOString().split('T').at(1)?.replace('Z', '')
      }
      return value.toISOString()
    }

    if (Buffer.isBuffer(value)) {
      return Array.from(value)
    }

    // Using lower case to make it consistent with the driver in prisma-engines.
    if (typeof value === 'string' && columns?.[i].type === sql.UniqueIdentifier) {
      return value.toLowerCase()
    }

    if (typeof value === 'boolean' && columns?.[i]?.type === sql.Bit) {
      return value ? 1 : 0
    }

    return value
  })
}
