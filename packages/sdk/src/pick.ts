export function pick<T extends object, U extends keyof T>(obj: T, keys: U[]): Pick<T, U> {
  return Object.entries(obj).reduce<Pick<T, U>>((acc, [key, value]) => {
    if (keys.includes(key as U)) {
      acc[key] = value
    }
    return acc
  }, {} as Pick<T, U>)
}
