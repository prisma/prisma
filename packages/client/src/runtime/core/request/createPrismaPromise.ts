import type { PrismaOperationSpec, PrismaPromise, PrismaPromiseTransaction } from './PrismaPromise'

export type PrismaPromiseCallback = (transaction?: PrismaPromiseTransaction) => Promise<unknown>

/**
 * Creates a [[PrismaPromise]]. It is Prisma's implementation of `Promise` which
 * is essentially a proxy for `Promise`. All the transaction-compatible client
 * methods return one, this allows for pre-preparing queries without executing
 * them until `.then` is called. It's the foundation of Prisma's query batching.
 * @param callback that will be wrapped within our promise implementation
 * @see [[PrismaPromise]]
 * @returns
 */
export type PrismaPromiseFactory = <T extends PrismaOperationSpec<unknown>>(
  callback: PrismaPromiseCallback,
  op?: T,
) => PrismaPromise<unknown>

/**
 * Creates a factory, that allows creating PrismaPromises, bound to a specific transactions
 * @param transaction
 * @returns
 */
export function createPrismaPromiseFactory(transaction?: PrismaPromiseTransaction): PrismaPromiseFactory {
  return function createPrismaPromise<TSpec extends PrismaOperationSpec<unknown>>(
    callback: PrismaPromiseCallback,
    op?: TSpec,
  ): PrismaPromise<unknown, TSpec> {
    let promise: PrismaPromise<unknown> | undefined
    const _callback = (callbackTransaction = transaction): PrismaPromise<unknown> => {
      try {
        // promises cannot be triggered twice after resolving
        if (callbackTransaction === undefined || callbackTransaction?.kind === 'itx') {
          return (promise ??= valueToPromise(callback(callbackTransaction)))
        }

        // but for batch tx we can trigger them again & again
        return valueToPromise(callback(callbackTransaction))
      } catch (error) {
        // if the callback throws, then we reject the promise
        // and that is because exceptions are not always async
        return Promise.reject(error) as PrismaPromise<unknown>
      }
    }

    return {
      get spec() {
        return op!
      },

      then(onFulfilled, onRejected) {
        return _callback().then(onFulfilled, onRejected)
      },
      catch(onRejected) {
        return _callback().catch(onRejected)
      },
      finally(onFinally) {
        return _callback().finally(onFinally)
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
}

function valueToPromise<T>(thing: T): PrismaPromise<T> {
  if (typeof thing.then === 'function') {
    return thing as PrismaPromise<T>
  }

  return Promise.resolve(thing) as PrismaPromise<T>
}
