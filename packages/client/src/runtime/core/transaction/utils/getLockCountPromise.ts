/**
 * Creates a an exotic promise that opens after x `await`s.
 * @remarks
 * This is currently used for locking regular transactions.
 * This ensures that all queries are executed at once/batched.
 * Even if middlewares are in use, they all execute at once.
 * @param knock
 * @returns
 */
export function getLockCountPromise<V = void>(knock: number, cb: () => V | void = () => {}) {
  let resolve: (v: V | void) => void
  const lock = new Promise<V | void>((res) => (resolve = res))

  return {
    then(onFulfilled) {
      if (--knock === 0) resolve(cb())

      return onFulfilled?.(lock as unknown as V | void)
    },
  } as PromiseLike<V | void>
}
