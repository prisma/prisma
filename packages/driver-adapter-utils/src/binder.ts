import { isDriverAdapterError } from './error'
import { err, ok, type Result } from './result'
import type {
  ErrorCapturingSqlConnection,
  ErrorCapturingTransaction,
  ErrorCapturingTransactionContext,
  ErrorRecord,
  ErrorRegistry,
  SqlConnection,
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
export const bindAdapter = (adapter: SqlConnection): ErrorCapturingSqlConnection => {
  const errorRegistry = new ErrorRegistryInternal()

  const createTransactionContext = wrapAsync(errorRegistry, adapter.transactionContext.bind(adapter))

  const boundAdapter: ErrorCapturingSqlConnection = {
    adapterName: adapter.adapterName,
    errorRegistry,
    queryRaw: wrapAsync(errorRegistry, adapter.queryRaw.bind(adapter)),
    executeRaw: wrapAsync(errorRegistry, adapter.executeRaw.bind(adapter)),
    executeScript: wrapAsync(errorRegistry, adapter.executeScript.bind(adapter)),
    dispose: wrapAsync(errorRegistry, adapter.dispose.bind(adapter)),
    provider: adapter.provider,
    transactionContext: async (...args) => {
      const ctx = await createTransactionContext(...args)
      return ctx.map((ctx) => bindTransactionContext(errorRegistry, ctx))
    },
  }

  if (adapter.getConnectionInfo) {
    boundAdapter.getConnectionInfo = wrapSync(errorRegistry, adapter.getConnectionInfo.bind(adapter))
  }

  return boundAdapter
}

// *.bind(ctx) is required to preserve the `this` context of functions whose
// execution is delegated to napi.rs.
const bindTransactionContext = (
  errorRegistry: ErrorRegistryInternal,
  ctx: TransactionContext,
): ErrorCapturingTransactionContext => {
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
const bindTransaction = (errorRegistry: ErrorRegistryInternal, transaction: Transaction): ErrorCapturingTransaction => {
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
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<Result<R>> {
  return async (...args) => {
    try {
      return ok(await fn(...args))
    } catch (error) {
      // unwrap the cause of exceptions thrown by driver adapters if there is one
      if (isDriverAdapterError(error)) {
        return err(error.cause)
      }
      const id = registry.registerNewError(error)
      return err({ kind: 'GenericJs', id })
    }
  }
}

function wrapSync<A extends unknown[], R>(
  registry: ErrorRegistryInternal,
  fn: (...args: A) => R,
): (...args: A) => Result<R> {
  return (...args) => {
    try {
      return ok(fn(...args))
    } catch (error) {
      // unwrap the cause of exceptions thrown by driver adapters if there is one
      if (isDriverAdapterError(error)) {
        return err(error.cause)
      }
      const id = registry.registerNewError(error)
      return err({ kind: 'GenericJs', id })
    }
  }
}
