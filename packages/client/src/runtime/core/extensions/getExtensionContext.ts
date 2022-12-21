export function getExtensionContext<T>(that: { [K: symbol]: T }) {
  return that as any as T
}
