export function mapKeys<T extends object>(obj: T, mapper: (key: keyof T) => string): any {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    acc[mapper(key as keyof T)] = value
    return acc
  }, {})
}
