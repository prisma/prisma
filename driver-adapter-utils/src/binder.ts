import type { ErrorCapturingDriverAdapter, DriverAdapter, Transaction, ErrorRegistry, ErrorRecord, Result } from './types'

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

  return {
    errorRegistry,
    queryRaw: wrapAsync(errorRegistry, adapter.queryRaw.bind(adapter)),
    executeRaw: wrapAsync(errorRegistry, adapter.executeRaw.bind(adapter)),
    flavour: adapter.flavour,
    startTransaction: async (...args) => {
      const result = await adapter.startTransaction(...args)
      if (result.ok) {
        return { ok: true, value: bindTransaction(errorRegistry, result.value) }
      }
      return result
    },
    close: wrapAsync(errorRegistry, adapter.close.bind(adapter))
  }
}

// *.bind(transaction) is required to preserve the `this` context of functions whose
// execution is delegated to napi.rs.
const bindTransaction = (errorRegistry: ErrorRegistryInternal, transaction: Transaction): Transaction => {
  return ({
    flavour: transaction.flavour,
    options: transaction.options,
    queryRaw: wrapAsync(errorRegistry, transaction.queryRaw.bind(transaction)),
    executeRaw: wrapAsync(errorRegistry, transaction.executeRaw.bind(transaction)),
    commit: wrapAsync(errorRegistry, transaction.commit.bind(transaction)),
    rollback: wrapAsync(errorRegistry, transaction.rollback.bind(transaction)),
  });
}

function wrapAsync<A extends unknown[], R>(registry: ErrorRegistryInternal, fn: (...args: A) => Promise<Result<R>>): (...args: A) => Promise<Result<R>> {
  return async (...args) => {
    try {
      return await fn(...args)
    } catch (error) {
      const id = registry.registerNewError(error)
      return { ok: false, error: { kind: 'GenericJsError', id } }
    }
  }
}