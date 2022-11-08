export function getExtensionContext<T>(that: T) {
  return that as { [K in keyof T]-?: T[K] }
}
