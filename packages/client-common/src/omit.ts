export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  return Object.fromEntries(Object.entries(obj).filter(([key, _]) => !keys.includes(key as K))) as Omit<T, K>
}
