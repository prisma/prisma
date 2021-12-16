export function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  return Object.keys(obj)
    .filter((key) => keys.includes(key as any))
    .reduce<Pick<T, K>>((result, key) => {
      result[key] = obj[key]
      return result
    }, {} as any)
}
