type AsyncFn<Args extends unknown[], R> = (...args: Args) => Promise<R>

/**
 * Takes an async function `fn` as a parameters and returns a wrapper function, which ensures
 * that `fn` will be called only once:
 *
 * - If the first call is not finished yet, returns the promise to the same result
 * - If the first call is finished, returns the result of this call
 * @param fn
 * @returns
 */
export function callOnce<Args extends unknown[], R>(fn: AsyncFn<Args, R>): AsyncFn<Args, R> {
  let result: Promise<R> | undefined
  return (...args) => (result ??= fn(...args))
}
