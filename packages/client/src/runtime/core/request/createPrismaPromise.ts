import { TransactionTracer } from '../../../utils/TransactionTracer'
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
  callback: (
    txId?: string | number,
    lock?: PromiseLike<void> | undefined,
    transactionTracer?: TransactionTracer,
  ) => PrismaPromise<unknown>,
): PrismaPromise<unknown> {
  let promise: PrismaPromise<unknown> | undefined
  const _callback = (txId?: string | number, lock?: PromiseLike<void>, transactionTracer?: TransactionTracer) => {
    try {
      // we allow the callback to be executed only one time
      return (promise ??= callback(txId, lock, transactionTracer))
    } catch (error) {
      // if the callback throws, then we reject the promise
      // and that is because exceptions are not always async
      return Promise.reject(error) as PrismaPromise<unknown>
    }
  }

  return {
    then(onFulfilled, onRejected, txId?: string, transactionTracer?: TransactionTracer) {
      return _callback(txId, undefined, transactionTracer).then(onFulfilled, onRejected, txId)
    },
    catch(onRejected, txId?: string, transactionTracer?: TransactionTracer) {
      return _callback(txId, undefined, transactionTracer).catch(onRejected, txId)
    },
    finally(onFinally, txId?: string, transactionTracer?: TransactionTracer) {
      return _callback(txId, undefined, transactionTracer).finally(onFinally, txId)
    },
    requestTransaction(txId: number, lock?: PromiseLike<void>, transactionTracer?: TransactionTracer) {
      const promise = _callback(txId, lock, transactionTracer)

      if (promise.requestTransaction) {
        // we want to have support for nested promises
        return promise.requestTransaction(txId, lock, transactionTracer)
      }

      return promise
    },
    [Symbol.toStringTag]: 'PrismaPromise',
  }
}
