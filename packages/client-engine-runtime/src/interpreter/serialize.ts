import type { ResultSet } from '@prisma/driver-adapter-utils'

export function serialize(resultSet: ResultSet): Record<string, unknown>[] {
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
