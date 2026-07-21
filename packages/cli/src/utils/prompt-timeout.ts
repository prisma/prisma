/**
 * Wraps a promise with a timeout. If the provided promise does not resolve within the given
 * time, the returned promise resolves to `undefined`. If it rejects, the returned promise
 * rejects with the original error.
 */
export function timeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise<T | undefined>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      resolve(undefined)
    }, ms)

    promise.then(resolve, reject).finally(() => clearTimeout(timeoutId))
  })
}
