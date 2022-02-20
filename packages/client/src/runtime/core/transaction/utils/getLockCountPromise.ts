/**
 * Creates a an exotic promise that opens after x `await`s.
 * @remarks
 * This is currently used for locking regular transactions.
 * This ensures that all queries are executed at once/batched.
 * Even if middlewares are in use, they all execute at once.
 * @param knock
 * @returns
 */
export function getLockCountPromise<V>(knock: number, cb: () => V) {
  let resolve: (v: V) => void
  const lock = new Promise<V>((res) => (resolve = res))

  return {
    then(onFulfilled) {
      if (--knock === 0) resolve(cb())

      return onFulfilled?.(lock as unknown as V)
    },
  } as PromiseLike<V>
}
