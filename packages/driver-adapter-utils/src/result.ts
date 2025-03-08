import type { Error } from './types'

export type Result<T> = {
  // common methods
  map<U>(fn: (value: T) => U): Result<U>
  flatMap<U>(fn: (value: T) => Result<U>): Result<U>
} & (
  | {
      readonly ok: true
      readonly value: T
    }
  | {
      readonly ok: false
      readonly error: Error
    }
)

export function ok<T>(value: T): Result<T> {
  return {
    ok: true,
    value,
    map(fn) {
      return ok(fn(value))
    },
    flatMap(fn) {
      return fn(value)
    },
  }
}

export function err<T>(error: Error): Result<T> {
  return {
    ok: false,
    error,
    map() {
      return err(error)
    },
    flatMap() {
      return err(error)
    },
  }
}
