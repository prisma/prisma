export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  return Object.keys(obj)
    .filter((key) => !keys.includes(key as any))
    .reduce<Omit<T, K>>((result, key) => {
      result[key] = obj[key]
      return result
    }, {} as any)
}
