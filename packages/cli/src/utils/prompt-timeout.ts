/**
 * Wraps a promise with a timeout. If the provided promise does not resolve within the given
 * time, the returned promise resolves to `undefined`.
 */
export function timeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve(undefined)
    }, ms)

    return promise.then((result) => {
      clearTimeout(timeoutId)
      resolve(result)
    })
  })
}
