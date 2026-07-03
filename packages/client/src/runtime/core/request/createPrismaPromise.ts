import type {
  PrismaOperationSpec,
  PrismaPromise,
  PrismaPromiseBatchTransaction,
  PrismaPromiseTransaction,
} from './PrismaPromise'

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
    return new PrismaPromiseImpl(callback, transaction, op)
  }
}

class PrismaPromiseImpl<TSpec extends PrismaOperationSpec<unknown>> implements PrismaPromise<unknown, TSpec> {
  private promise: PrismaPromise<unknown> | undefined

  constructor(
    private readonly callback: PrismaPromiseCallback,
    private readonly transaction?: PrismaPromiseTransaction,
    private readonly op?: TSpec,
  ) {}

  get spec(): TSpec {
    return this.op!
  }

  then<TResult1 = unknown, TResult2 = never>(
    onFulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null,
    transaction?: PrismaPromiseTransaction,
  ): Promise<TResult1 | TResult2> {
    return this.callbackWithTransaction(transaction).then(onFulfilled ?? undefined, onRejected ?? undefined)
  }

  catch<TResult = never>(
    onRejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
    transaction?: PrismaPromiseTransaction,
  ): Promise<unknown> {
    return this.callbackWithTransaction(transaction).catch(onRejected)
  }

  finally(onFinally?: (() => void) | undefined | null, transaction?: PrismaPromiseTransaction): Promise<unknown> {
    return this.callbackWithTransaction(transaction).finally(onFinally)
  }

  requestTransaction(batchTransaction: PrismaPromiseBatchTransaction): PromiseLike<unknown> {
    const promise = this.callbackWithTransaction(batchTransaction)

    if (promise.requestTransaction) {
      // we want to have support for nested promises
      return promise.requestTransaction(batchTransaction)
    }

    return promise
  }

  get [Symbol.toStringTag](): string {
    return 'PrismaPromise'
  }

  private callbackWithTransaction(callbackTransaction = this.transaction): PrismaPromise<unknown> {
    try {
      // promises cannot be triggered twice after resolving
      if (callbackTransaction === undefined || callbackTransaction?.kind === 'itx') {
        return (this.promise ??= valueToPromise(this.callback(callbackTransaction)))
      }

      // but for batch tx we can trigger them again & again
      return valueToPromise(this.callback(callbackTransaction))
    } catch (error) {
      // if the callback throws, then we reject the promise
      // and that is because exceptions are not always async
      return Promise.reject(error) as PrismaPromise<unknown>
    }
  }
}

function valueToPromise<T>(thing: T): PrismaPromise<T> {
  if (typeof thing['then'] === 'function') {
    return thing as PrismaPromise<T>
  }

  return Promise.resolve(thing) as PrismaPromise<T>
}
