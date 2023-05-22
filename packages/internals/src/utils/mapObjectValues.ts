export function mapObjectValues<K extends PropertyKey, T, U>(
  object: Record<K, T>,
  mapper: (value: T, key: K) => U,
): Record<K, U> {
  const result = {} as Record<K, U>

  for (const key of Object.keys(object)) {
    result[key] = mapper(object[key] as T, key as K)
  }

  return result
}
