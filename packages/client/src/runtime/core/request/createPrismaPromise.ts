import type { PrismaPromise } from './PrismaPromise'

/**
 * Creates a [[PrismaPromise]]. It is Prisma's implementation of `Promise` which
 * is essentially a proxy for `Promise`. All the transaction-compatible client
 * methods return one, this allows for pre-preparing queries without executing
 * them until `.then` is called. It's the foundation of Prisma's query batching.
 * @param callback that will be wrapped within our promise implementation
 * @see [[PrismaPromise]]
 * @returns
 */
export function createPrismaPromise(
  callback: (txId?: string | number, lock?: PromiseLike<void>) => PrismaPromise<unknown>,
): PrismaPromise<unknown> {
  let promise: PrismaPromise<unknown> | undefined
  const _callback = (txId?: string | number, lock?: PromiseLike<void>, cached = true) => {
    try {
      // promises cannot be triggered twice after resolving
      if (cached === true) {
        return (promise ??= callback(txId, lock))
      }

      // but for for batch tx we need to trigger them again
      return callback(txId, lock)
    } catch (error) {
      // if the callback throws, then we reject the promise
      // and that is because exceptions are not always async
      return Promise.reject(error) as PrismaPromise<unknown>
    }
  }

  return {
    then(onFulfilled, onRejected, txId?: string) {
      return _callback(txId, undefined).then(onFulfilled, onRejected, txId)
    },
    catch(onRejected, txId?: string) {
      return _callback(txId, undefined).catch(onRejected, txId)
    },
    finally(onFinally, txId?: string) {
      return _callback(txId, undefined).finally(onFinally, txId)
    },
    requestTransaction(txId: number, lock?: PromiseLike<void>) {
      const promise = _callback(txId, lock, false)

      if (promise.requestTransaction) {
        // we want to have support for nested promises
        return promise.requestTransaction(txId, lock)
      }

      return promise
    },
    [Symbol.toStringTag]: 'PrismaPromise',
  }
}
