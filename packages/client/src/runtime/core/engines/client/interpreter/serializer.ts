import { SQLResultSet } from '@prisma/driver-adapter-utils'

export function serialize(resultSet: SQLResultSet): Record<string, unknown>[] {
  return resultSet.rows.map((row) =>
    row.reduce<Record<string, unknown>>((acc, value, index) => {
      acc[resultSet.columnNames[index]] = value
      return acc
    }, {}),
  )
}
