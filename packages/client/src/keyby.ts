export interface Dictionary<T> {
  [key: string]: T
}

export const keyBy: <T>(collection: T[], iteratee: (value: T) => string) => Dictionary<T> = (collection, iteratee) => {
  return collection.reduce<any>((acc, curr) => {
    acc[iteratee(curr)] = curr
    return acc
  }, {})
}
