import type { InteractiveTransactionOptions, PrismaPromise, PrismaPromiseTransaction } from './PrismaPromise'

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
  callback: (transaction?: PrismaPromiseTransaction, lock?: PromiseLike<void>) => PrismaPromise<unknown>,
): PrismaPromise<unknown> {
  let promise: PrismaPromise<unknown> | undefined
  const _callback = (transaction?: PrismaPromiseTransaction, lock?: PromiseLike<void>, cached = true) => {
    try {
      // promises cannot be triggered twice after resolving
      if (cached === true) {
        return (promise ??= valueToPromise(callback(transaction, lock)))
      }

      // but for batch tx we need to trigger them again
      return valueToPromise(callback(transaction, lock))
    } catch (error) {
      // if the callback throws, then we reject the promise
      // and that is because exceptions are not always async
      return Promise.reject(error) as PrismaPromise<unknown>
    }
  }

  return {
    then(onFulfilled, onRejected, transaction?) {
      return _callback(createItx(transaction), undefined).then(onFulfilled, onRejected, transaction)
    },
    catch(onRejected, transaction?) {
      return _callback(createItx(transaction), undefined).catch(onRejected, transaction)
    },
    finally(onFinally, transaction?) {
      return _callback(createItx(transaction), undefined).finally(onFinally, transaction)
    },

    requestTransaction(transactionOptions, lock?: PromiseLike<void>) {
      const transaction = { kind: 'batch' as const, ...transactionOptions }
      const promise = _callback(transaction, lock, false)

      if (promise.requestTransaction) {
        // we want to have support for nested promises
        return promise.requestTransaction(transaction, lock)
      }

      return promise
    },
    [Symbol.toStringTag]: 'PrismaPromise',
  }
}

function createItx(transaction: InteractiveTransactionOptions | undefined): PrismaPromiseTransaction | undefined {
  if (transaction) {
    return { kind: 'itx', ...transaction }
  }
  return undefined
}

function valueToPromise<T>(thing: T): PrismaPromise<T> {
  if (typeof thing['then'] === 'function') {
    return thing as Promise<T>
  }

  return Promise.resolve(thing)
}
