import { TransactionTracer } from '@prisma/engine-core'

/**
 * Prisma's `Promise` that is backwards-compatible. All additions on top of the
 * original `Promise` are optional so that it can be backwards-compatible.
 * @see [[createPrismaPromise]]
 */
export interface PrismaPromise<A> extends Promise<A> {
  /**
   * Extension of the original `.then` function
   * @param onfulfilled same as regular promises
   * @param onrejected same as regular promises
   * @param txId GUID for interactive txs
   */
  then<R1 = A, R2 = never>(
    onfulfilled?: (value: A) => R1 | PromiseLike<R1>,
    onrejected?: (error: unknown) => R2 | PromiseLike<R2>,
    txId?: string,
  ): Promise<R1 | R2>

  /**
   * Extension of the original `.catch` function
   * @param onrejected same as regular promises
   * @param txId GUID for interactive txs
   */
  catch<R = never>(onrejected?: ((reason: any) => R | PromiseLike<R>) | undefined | null, txId?: string): Promise<A | R>

  /**
   * Extension of the original `.finally` function
   * @param onfinally same as regular promises
   * @param txId GUID for interactive txs
   */
  finally(onfinally?: (() => void) | undefined | null, txId?: string): Promise<A>

  /**
   * Called when executing a batch of regular tx
   * @param txId for regular tx ids
   */
  requestTransaction?(
    txId: number,
    lock?: PromiseLike<void>,
    transactionTracer?: TransactionTracer,
  ): PromiseLike<unknown>
}
