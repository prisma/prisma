export const unknownToError = (unknown: unknown): Error => {
  if (unknown instanceof Error) return unknown
  return new Error(`Unknown error: ${unknown}`)
}

export const id = <T>(value: T) => value

export type Mapped<T> = { [Key in keyof T]: T[Key] }

export type NoInfer<T> = [T][T extends unknown ? 0 : never]

export const isObject = (obj: unknown): obj is object => {
  return obj !== null && typeof obj === 'object' && !Array.isArray(obj)
}

export const tryCatch = <$Error extends Error, $Return>(
  fn: () => $Return,
  catcher?: (e: Error) => $Error,
): $Return | $Error => {
  try {
    return fn()
  } catch (e) {
    return catcher ? catcher(unknownToError(e)) : (unknownToError(e) as $Error)
  }
}
