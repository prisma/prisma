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
  callback: (transactionId?: number, runInTransaction?: boolean, otelCtx?: Context) => PrismaPromise<unknown>,
): PrismaPromise<unknown> {
  const otelCtx = context.active() // get the context at time of creation
  // because otel isn't able to propagate context when inside of a promise

  let promise: PrismaPromise<unknown> | undefined
  const _callback = (txId?: number, inTx?: boolean) => {
    try {
      // we allow the callback to be executed only one time
      return (promise ??= callback(txId, inTx, otelCtx))
    } catch (error) {
      // if the callback throws, then we reject the promise
      // and that is because exceptions are not always async
      return Promise.reject(error) as PrismaPromise<unknown>
    }
  }

  return {
    then(onFulfilled, onRejected, txId?: number) {
      return _callback(txId, false).then(onFulfilled, onRejected, txId)
    },
    catch(onRejected) {
      return _callback().catch(onRejected)
    },
    finally(onFinally) {
      return _callback().finally(onFinally)
    },
    requestTransaction(txId: number) {
      const promise = _callback(txId, true)

      if (promise.requestTransaction) {
        // requestTransaction support for nested promises
        return promise.requestTransaction(txId)
      }

      return promise
    },
    [Symbol.toStringTag]: 'PrismaPromise',
  }
}
