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
