/**
 * Omit key-value pairs from object.
 * @param obj Object to omit key-value pairs from
 * @param keys Keys to omit
 */
export function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  return Object.keys(obj)
    .filter((key) => !keys.includes(key as any))
    .reduce<Omit<T, K>>((result, key) => {
      result[key] = obj[key]
      return result
    }, {} as any)
}
