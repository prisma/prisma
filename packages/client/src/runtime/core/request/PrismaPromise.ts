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
   * @param txId string for iTX & Promise for regular tx
   */
  then<R1 = A, R2 = never>(
    onfulfilled?: (value: A) => R1 | PromiseLike<R1>,
    onrejected?: (error: unknown) => R2 | PromiseLike<R2>,
    txId?: string,
  ): Promise<R1 | R2>

  /**
   * Called when executing a batch of regular tx
   * @param id for regular tx ids
   */
  requestTransaction?(id: number, lock?: PromiseLike<void>): PromiseLike<unknown>
}
