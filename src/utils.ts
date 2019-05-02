export type Dictionary<T> = { [key: string]: T }

export function keyBy<T>(collection: Array<T>, iteratee: (value: T) => string): Dictionary<T> {
  return collection.reduce((acc, curr) => {
    acc[iteratee(curr)] = curr
    return acc
  }, {})
}
