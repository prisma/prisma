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

        // console.log(`candidate value: ${candidateValue}`)
        // console.log(`column index: ${columnTypes[columnIndex]}`)

        continue columnLoop
      }
    }

    // No non-null value found for this column, fall back to int32 to mimic what quaint does
    columnTypes[columnIndex] = ColumnTypeEnum.Int32
  }

  return columnTypes as ColumnType[]
}

/**
 * Default mapping between JS and D1 types.
 * | JavaScript       | D1           |
 * | :--------------: | :---------:  |
 * | null             | NULL         |
 * | Number           | REAL         |
 * | Number¹          | INTEGER      |
 * | null             | TEXT         |
 * | Boolean²         | INTEGER      |
 * | ArrayBuffer      | BLOB         |
 *
 * ¹ - D1 supports 64-bit signed INTEGER values internally, however BigInts are not currently supported in the API yet. JavaScript integers are safe up to Number.MAX_SAFE_INTEGER.
 *
 * ² - Booleans will be cast to an INTEGER type where 1 is TRUE and 0 is FALSE.
 */
function inferColumnType(value: NonNullable<Value>): ColumnType {
  switch (typeof value) {
    case 'string':
      return inferStringType(value)
    // case 'bigint':
    //   return ColumnTypeEnum.Int64
    // case 'boolean':
    //   return ColumnTypeEnum.Boolean
    case 'number':
      return inferNumberType(value)
    case 'object':
      return inferObjectType(value)
    default:
      throw new UnexpectedTypeError(value)
  }
}

function inferStringType(value: string): ColumnType {
  // ? :thinking: if this is a good way to do it
  if (['true', 'false'].includes(value.toLowerCase())) {
    return ColumnTypeEnum.Boolean
  }

  if (!(value.indexOf('.') == -1)) {
    return ColumnTypeEnum.Double
  }

  if (new Date(value).getTime() > 0) {
    return ColumnTypeEnum.DateTime
  }

  return ColumnTypeEnum.Text
}

function inferNumberType(value: number): ColumnType {
  if (value % 1 !== 0) {
    return ColumnTypeEnum.Float
  }

  return ColumnTypeEnum.UnknownNumber

  // // Hack - TODO change this when we have type metadata
  // if (Number.isInteger(value) && Math.abs(value) < Number.MAX_SAFE_INTEGER) {
  //   return ColumnTypeEnum.Int32
  // } else {
  //   return ColumnTypeEnum.UnknownNumber
  // }
}

function inferObjectType(value: Object): ColumnType {
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

// TODO(@druue) This currently mimics mapD1ToRows without the extra type functionality.
// TODO(@druue) next step is to implement further types.
export function mapRow(obj: Object, columnTypes: ColumnType[]): unknown[] {
  const result: unknown[] = Object.keys(obj).map((k) => obj[k])

  for (let i = 0; i < result.length; i++) {
    const value = result[i]

    console.log(`result : ${value}`)
    console.log(`column type ${columnTypes[i]}`)

    if (value instanceof ArrayBuffer) {
      result[i] = Array.from(new Uint8Array(value))
      continue
    }

    if (
      typeof value === 'number' &&
      (columnTypes[i] === ColumnTypeEnum.Int32 || columnTypes[i] === ColumnTypeEnum.Int64) &&
      !Number.isInteger(value)
    ) {
      result[i] = Math.trunc(value)
      continue
    }

    // if (['number', 'bigint'].includes(typeof value) && columnTypes[i] === ColumnTypeEnum.DateTime) {
    //   result[i] = new Date(Number(value)).toISOString()
    //   continue
    // }

    // if (typeof value === 'bigint') {
    //   result[i] = value.toString()
    //   continue
    // }

    if (typeof value === 'string' && columnTypes[i] === ColumnTypeEnum.Double) {
      result[i] = Number.parseFloat(value)
      continue
    }

    if (columnTypes[i] === ColumnTypeEnum.Boolean) {
      result[i] = JSON.parse(value as any)
    }
  }

  return result
}
