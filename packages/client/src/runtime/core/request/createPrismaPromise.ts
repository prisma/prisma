import type { Context } from '@opentelemetry/api'
import { context } from '@opentelemetry/api'

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
  callback: (txId?: string | number, lock?: PromiseLike<void>, otelCtx?: Context) => PrismaPromise<unknown>,
): PrismaPromise<unknown> {
  const otelCtx = context.active() // get the context at time of creation
  // because otel isn't able to propagate context when inside of a promise

  let promise: PrismaPromise<unknown> | undefined
  const _callback = (txId?: string | number, lock?: PromiseLike<void>) => {
    try {
      // we allow the callback to be executed only one time
      return (promise ??= callback(txId, lock, otelCtx))
    } catch (error) {
      // if the callback throws, then we reject the promise
      // and that is because exceptions are not always async
      return Promise.reject(error) as PrismaPromise<unknown>
    }
  }

  return {
    then(onFulfilled, onRejected, txId?: string) {
      return _callback(txId).then(onFulfilled, onRejected, txId)
    },
    catch(onRejected, txId?: string) {
      return _callback(txId).catch(onRejected, txId)
    },
    finally(onFinally, txId?: string) {
      return _callback(txId).finally(onFinally, txId)
    },
    requestTransaction(txId: number, lock?: PromiseLike<void>) {
      const promise = _callback(txId, lock)

      if (promise.requestTransaction) {
        // we want to have support for nested promises
        return promise.requestTransaction(txId, lock)
      }

      return promise
    },
    [Symbol.toStringTag]: 'PrismaPromise',
  }
}
