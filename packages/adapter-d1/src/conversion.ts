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
    case 'number':
      return inferNumberType(value)
    case 'object':
      return inferObjectType(value)
    default:
      throw new UnexpectedTypeError(value)
  }
}

// See https://stackoverflow.com/a/3143231/1345244
const isoDateRegex = new RegExp(
  /(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/,
)
function isISODate(str) {
  return isoDateRegex.test(str)
}

function inferStringType(value: string): ColumnType {
  if (['true', 'false'].includes(value)) {
    return ColumnTypeEnum.Boolean
  }

  if (isISODate(value)) {
    return ColumnTypeEnum.DateTime
  }

  return ColumnTypeEnum.Text
}

function inferNumberType(value: number): ColumnType {
  if (!Number.isInteger(value)) {
    return ColumnTypeEnum.Float
    // Note: returning "Numeric" makes is better for our Decimal type
    // But we can't tell what is a float or a decimal here
    // return ColumnTypeEnum.Numeric
  }
  // Hack - TODO change this when we have type metadata
  else if (Number.isInteger(value) && Math.abs(value) < Number.MAX_SAFE_INTEGER) {
    return ColumnTypeEnum.Int32
  } else {
    return ColumnTypeEnum.UnknownNumber
  }
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

export function mapRow(obj: Object, columnTypes: ColumnType[]): unknown[] {
  const result: unknown[] = Object.values(obj)

  for (let i = 0; i < result.length; i++) {
    const value = result[i]

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

    if (typeof value === 'bigint') {
      result[i] = value.toString()
      continue
    }

    if (columnTypes[i] === ColumnTypeEnum.Boolean) {
      result[i] = JSON.parse(value as any)
    }
  }

  return result
}
