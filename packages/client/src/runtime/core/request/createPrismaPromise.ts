import type { PrismaPromise } from './PrismaPromise'
import type { Context } from '@opentelemetry/api'
import { context } from '@opentelemetry/api'

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

  // we handle exceptions that happen in the scope as `Promise` rejections
  const _callback = (transactionId?: number, runInTransaction?: boolean) => {
    try {
      return callback(transactionId, runInTransaction, otelCtx)
    } catch (error) {
      // and that is because exceptions are not always async
      return Promise.reject(error) as PrismaPromise<unknown>
    }
  }

  return {
    then(onFulfilled, onRejected, transactionId?: number) {
      const promise = _callback(transactionId, false)

      return promise.then(onFulfilled, onRejected, transactionId)
    },
    catch(onRejected) {
      return _callback().catch(onRejected)
    },
    finally(onFinally) {
      return _callback().finally(onFinally)
    },
    requestTransaction(transactionId: number) {
      const promise = _callback(transactionId, true)

      if (promise.requestTransaction) {
        // requestTransaction support for nested promises
        return promise.requestTransaction(transactionId)
      }

      return promise
    },
    [Symbol.toStringTag]: 'PrismaPromise',
  }
}
