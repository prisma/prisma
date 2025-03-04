/**
 * Creates an exotic promise that opens after x `await`s.
 * @remarks
 * This is currently used for locking regular transactions.
 * This ensures that all queries are executed at once/batched.
 * Even if middlewares are in use, they'll all execute at once.
 * @param knock the amount of awaits to open the promise
 * @param cb the callback to execute and value to return
 * @returns
 */
export function getLockCountPromise<V = void>(knock: number, cb: () => V | undefined = () => {}) {
  let resolve: (v: V | undefined) => void
  const lock = new Promise<V | undefined>((res) => (resolve = res))

  return {
    then(onFulfilled) {
      if (--knock === 0) resolve(cb())

      return onFulfilled?.(lock as unknown as V | undefined)
    },
  } as PromiseLike<V | undefined>
}
