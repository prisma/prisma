import { AsyncLocalStorage } from "node:async_hooks"
import type { PrismaPromise, PrismaPromiseTransaction } from './PrismaPromise'

export type PrismaPromiseCallback = (transaction?: PrismaPromiseTransaction) => PrismaPromise<unknown>

/**
 * Creates a [[PrismaPromise]]. It is Prisma's implementation of `Promise` which
 * is essentially a proxy for `Promise`. All the transaction-compatible client
 * methods return one, this allows for pre-preparing queries without executing
 * them until `.then` is called. It's the foundation of Prisma's query batching.
 * @param callback that will be wrapped within our promise implementation
 * @see [[PrismaPromise]]
 * @returns
 */
export type PrismaPromiseFactory = (callback: PrismaPromiseCallback) => PrismaPromise<unknown>

/**
 * Creates a factory, that allows creating PrismaPromises, bound to a specific transactions
 * @param transaction
 * @returns
 */
export function createPrismaPromiseFactory(transaction?: PrismaPromiseTransaction): PrismaPromiseFactory {
  return function createPrismaPromise(callback) {
    // bind the current Async Context to the callback function
    // to ensure any use of AsyncLocalStorage.getStore() within
    // is not broken by the implementation of PrismaPromise as a 'thenable'
    // => Cloudflare Workers's implementation of AsyncLocalStorage does not
    // currently pass async context within thenables
    callback = AsyncLocalStorage.bind(callback);
    let promise: PrismaPromise<unknown> | undefined
    const _callback = (callbackTransaction = transaction) => {
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
  if (typeof thing['then'] === 'function') {
    return thing as Promise<T>
  }

  return Promise.resolve(thing)
}
