export function mapObjectValues<K extends PropertyKey, T, U>(
  object: Record<K, T>,
  mapper: (value: T, key: K) => U,
): Record<K, U> {
  return Object.fromEntries(
    Object.entries(object).map(([key, value]) => [key, mapper(value as T, key as K)]),
  ) as Record<K, U>
}
