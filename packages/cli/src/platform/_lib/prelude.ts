export const unknownToError = (unknown: unknown): Error => {
  if (unknown instanceof Error) return unknown
  return new Error(`Unknown error: ${unknown}`)
}

export const id = <T>(value: T) => value

export type Mapped<T> = { [Key in keyof T]: T[Key] }

export type NoInfer<T> = [T][T extends any ? 0 : never]
