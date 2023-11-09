import { Error } from './types'

export type Result<T> = {
  // common methods
  map<U>(fn: (value: T) => U): Result<U>
  flatMap<U>(fn: (value: T) => Result<U>): Result<U>
  asyncFlatMap<U>(fn: (value: T) => Promise<Result<U>>): Promise<Result<U>>
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
    asyncFlatMap(fn) {
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
    asyncFlatMap() {
      return Promise.resolve(err(error))
    },
  }
}

/**
 * Collect an array of results into an array of values wrapped in a single result.
 * Equivalent to `results.reduce((a, b) => a.flatMap((a) => b.map((b) => a.concat(b))), ok([] as T[]))`.
 */
export function sequence<T>(results: Result<T>[]): Result<T[]> {
  const collected: T[] = []
  for (const result of results) {
    if (result.ok) {
      collected.push(result.value)
    } else {
      return result as Result<T[]>
    }
  }
  return ok(collected)
}
