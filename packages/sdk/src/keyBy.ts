export interface Dictionary<T> {
  [key: string]: T
}

/**
 * Reduce over the keys of the iterable.
 * @param collection Any array-like data structure.
 * @param iteratee Callback to be called on every element.
 */
export const keyBy: <T>(collection: T[], iteratee: (value: T) => string) => Dictionary<T> = (collection, iteratee) => {
  return collection.reduce<any>((acc, curr) => {
    acc[iteratee(curr)] = curr
    return acc
  }, {})
}
