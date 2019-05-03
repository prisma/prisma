import leven from 'js-levenshtein'

export type Dictionary<T> = { [key: string]: T }

export const keyBy: <T>(collection: Array<T>, iteratee: (value: T) => string) => Dictionary<T> = (
  collection,
  iteratee,
) => {
  return collection.reduce((acc, curr) => {
    acc[iteratee(curr)] = curr
    return acc
  }, {})
}

export const ScalarTypeTable = {
  String: true,
  Int: true,
  Float: true,
  Boolean: true,
  Long: true,
  DateTime: true,
  ID: true,
  UUID: true,
  Json: true,
}

export function isScalar(str: string): boolean {
  if (typeof str !== 'string') {
    return false
  }
  return ScalarTypeTable[str] || false
}

export function getSuggestion(str: string, possibilities: string[]): string | null {
  const bestMatch = possibilities.reduce(
    (acc, curr) => {
      const distance = leven(str, curr)
      if (distance < acc.distance) {
        return {
          distance,
          str: curr,
        }
      }

      return acc
    },
    {
      distance: str.length, // if the whole string would need to be replaced, it doesn't make sense
      str: null,
    },
  )

  return bestMatch.str
}
