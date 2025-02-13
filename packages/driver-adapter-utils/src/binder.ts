import { err, Result } from './result'
import type {
  DriverAdapter,
  ErrorCapturingDriverAdapter,
  ErrorRecord,
  ErrorRegistry,
  Transaction,
  TransactionContext,
} from './types'

class ErrorRegistryInternal implements ErrorRegistry {
  private registeredErrors: ErrorRecord[] = []

  consumeError(id: number): ErrorRecord | undefined {
    return this.registeredErrors[id]
  }

  registerNewError(error: unknown) {
    let i = 0
    while (this.registeredErrors[i] !== undefined) {
      i++
    }
    this.registeredErrors[i] = { error }
    return i
  }
}

// *.bind(adapter) is required to preserve the `this` context of functions whose
// execution is delegated to napi.rs.
export const bindAdapter = (adapter: DriverAdapter): ErrorCapturingDriverAdapter => {
  const errorRegistry = new ErrorRegistryInternal()

  const createTransactionContext = wrapAsync(errorRegistry, adapter.transactionContext.bind(adapter))

  const boundAdapter: ErrorCapturingDriverAdapter = {
    adapterName: adapter.adapterName,
    errorRegistry,
    queryRaw: wrapAsync(errorRegistry, adapter.queryRaw.bind(adapter)),
    executeRaw: wrapAsync(errorRegistry, adapter.executeRaw.bind(adapter)),
    provider: adapter.provider,
    transactionContext: async (...args) => {
      const ctx = await createTransactionContext(...args)
      return ctx.map((tx) => bindTransactionContext(errorRegistry, tx))
    },
  }

  if (adapter.getConnectionInfo) {
    boundAdapter.getConnectionInfo = wrapSync(errorRegistry, adapter.getConnectionInfo.bind(adapter))
  }

  return boundAdapter
}

// *.bind(ctx) is required to preserve the `this` context of functions whose
// execution is delegated to napi.rs.
const bindTransactionContext = (errorRegistry: ErrorRegistryInternal, ctx: TransactionContext): TransactionContext => {
  const startTransaction = wrapAsync(errorRegistry, ctx.startTransaction.bind(ctx))

  return {
    adapterName: ctx.adapterName,
    provider: ctx.provider,
    queryRaw: wrapAsync(errorRegistry, ctx.queryRaw.bind(ctx)),
    executeRaw: wrapAsync(errorRegistry, ctx.executeRaw.bind(ctx)),
    startTransaction: async (...args) => {
      const result = await startTransaction(...args)
      return result.map((tx) => bindTransaction(errorRegistry, tx))
    },
  }
}

// *.bind(transaction) is required to preserve the `this` context of functions whose
// execution is delegated to napi.rs.
const bindTransaction = (errorRegistry: ErrorRegistryInternal, transaction: Transaction): Transaction => {
  return {
    adapterName: transaction.adapterName,
    provider: transaction.provider,
    options: transaction.options,
    queryRaw: wrapAsync(errorRegistry, transaction.queryRaw.bind(transaction)),
    executeRaw: wrapAsync(errorRegistry, transaction.executeRaw.bind(transaction)),
    commit: wrapAsync(errorRegistry, transaction.commit.bind(transaction)),
    rollback: wrapAsync(errorRegistry, transaction.rollback.bind(transaction)),
  }
}

function wrapAsync<A extends unknown[], R>(
  registry: ErrorRegistryInternal,
  fn: (...args: A) => Promise<Result<R>>,
): (...args: A) => Promise<Result<R>> {
  return async (...args) => {
    try {
      return await fn(...args)
    } catch (error) {
      const id = registry.registerNewError(error)
      return err({ kind: 'GenericJs', id })
    }
  }
}

function wrapSync<A extends unknown[], R>(
  registry: ErrorRegistryInternal,
  fn: (...args: A) => Result<R>,
): (...args: A) => Result<R> {
  return (...args) => {
    try {
      return fn(...args)
    } catch (error) {
      const id = registry.registerNewError(error)
      return err({ kind: 'GenericJs', id })
    }
  }
}
