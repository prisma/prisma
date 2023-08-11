import Decimal from 'decimal.js'

type PrismaType =
  | 'int'
  | 'bigint'
  | 'float'
  | 'double'
  | 'string'
  | 'enum'
  | 'bytes'
  | 'bool'
  | 'char'
  | 'decimal'
  | 'json'
  | 'xml'
  | 'uuid'
  | 'datetime'
  | 'date'
  | 'time'
  | 'array'
  | 'null'

type TypedValue = {
  prisma__type: PrismaType
  prisma__value: unknown
}

export function deserializeRawResults(rows: Array<Record<string, TypedValue>>): unknown[] {
  return rows.map((row) => {
    const mappedRow = {} as Record<string, unknown>
    for (const key of Object.keys(row)) {
      mappedRow[key] = deserializeValue(row[key])
    }
    return mappedRow
  })
}

function deserializeValue({ prisma__type: type, prisma__value: value }: TypedValue): unknown {
  switch (type) {
    case 'bigint':
      return BigInt(value as string)

    case 'bytes':
      return Buffer.from(value as string, 'base64')

    case 'decimal':
      return new Decimal(value as string)

    case 'datetime':
    case 'date':
      return new Date(value as string)

    case 'time':
      return new Date(`1970-01-01T${value}Z`)

    case 'array':
      return (value as TypedValue[]).map(deserializeValue)

    default:
      return value
  }
}
