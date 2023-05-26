type AsyncFn<Args extends unknown[], R> = (...args: Args) => Promise<R>

/**
 * Takes an async function `fn` as a parameter and returns a wrapper function, which ensures
 * that `fn` will be called only once if the promise succeeds:
 *
 * - If the first call is not finished yet, returns the promise to the same result
 * - If the first call is finished and has succeeded, returns the result of this call
 * - If the first call is finished but has failed, `fn` is called again
 * @param fn
 * @returns
 */
export function callOnceOnSuccess<Args extends unknown[], R>(fn: AsyncFn<Args, R>): AsyncFn<Args, R> {
  let result: Promise<R> | undefined

  return (...args) => {
    if (result) {
      return result
    }

    result = fn(...args).catch((err) => {
      result = undefined
      throw err
    })

    return result
  }
}
