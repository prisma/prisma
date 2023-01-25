import type { PrismaPromise, PrismaPromiseTransaction } from './PrismaPromise'

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
  callback: (transaction?: PrismaPromiseTransaction) => PrismaPromise<unknown>,
): PrismaPromise<unknown> {
  let promise: PrismaPromise<unknown> | undefined
  const _callback = (transaction?: PrismaPromiseTransaction) => {
    try {
      // promises cannot be triggered twice after resolving
      if (transaction === undefined || transaction?.kind === 'itx') {
        return (promise ??= valueToPromise(callback(transaction)))
      }

      // but for batch tx we can trigger them again & again
      return valueToPromise(callback(transaction))
    } catch (error) {
      // if the callback throws, then we reject the promise
      // and that is because exceptions are not always async
      return Promise.reject(error) as PrismaPromise<unknown>
    }
  }

  return {
    then(onFulfilled, onRejected, transaction?) {
      return _callback(transaction).then(onFulfilled, onRejected, transaction)
    },
    catch(onRejected, transaction?) {
      return _callback(transaction).catch(onRejected, transaction)
    },
    finally(onFinally, transaction?) {
      return _callback(transaction).finally(onFinally, transaction)
    },

    requestTransaction(batchTransaction) {
      const promise = _callback(batchTransaction)

      if (promise.requestTransaction) {
        // we want to have support for nested promises
        return promise.requestTransaction(batchTransaction)
      }

      return promise
    },
    [Symbol.toStringTag]: 'PrismaPromise',
  }
}

function valueToPromise<T>(thing: T): PrismaPromise<T> {
  if (typeof thing['then'] === 'function') {
    return thing as Promise<T>
  }

  return Promise.resolve(thing)
}
