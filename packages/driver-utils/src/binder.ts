import { Debug } from './debug'
import { isDriverAdapterError } from './error'
import { err, ok, Result } from './result'
import type {
  ErrorCapturingSqlDriver,
  ErrorCapturingSqlDriverFactory,
  ErrorCapturingSqlMigrationAwareDriverFactory,
  ErrorCapturingTransaction,
  ErrorRecord,
  ErrorRegistry,
  SqlDriver,
  SqlDriverFactory,
  SqlMigrationAwareDriverFactory,
  Transaction,
} from './types'

const debug = Debug('driver-utils')

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

export const bindMigrationAwareSqlDriverFactory = (
  adapterFactory: SqlMigrationAwareDriverFactory,
): ErrorCapturingSqlMigrationAwareDriverFactory => {
  const errorRegistry = new ErrorRegistryInternal()

  const boundFactory: ErrorCapturingSqlMigrationAwareDriverFactory = {
    driverName: adapterFactory.driverName,
    provider: adapterFactory.provider,
    errorRegistry,
    connect: async (...args) => {
      const ctx = await wrapAsync(errorRegistry, adapterFactory.connect.bind(adapterFactory))(...args)
      return ctx.map((ctx) => bindAdapter(ctx, errorRegistry))
    },
    connectToShadowDb: async (...args) => {
      const ctx = await wrapAsync(errorRegistry, adapterFactory.connectToShadowDb.bind(adapterFactory))(...args)
      return ctx.map((ctx) => bindAdapter(ctx, errorRegistry))
    },
  }

  return boundFactory
}

export const bindSqlDriverFactory = (adapterFactory: SqlDriverFactory): ErrorCapturingSqlDriverFactory => {
  const errorRegistry = new ErrorRegistryInternal()

  const boundFactory: ErrorCapturingSqlDriverFactory = {
    driverName: adapterFactory.driverName,
    provider: adapterFactory.provider,
    errorRegistry,
    connect: async (...args) => {
      const ctx = await wrapAsync(errorRegistry, adapterFactory.connect.bind(adapterFactory))(...args)
      return ctx.map((ctx) => bindAdapter(ctx, errorRegistry))
    },
  }

  return boundFactory
}

// *.bind(adapter) is required to preserve the `this` context of functions whose
// execution is delegated to napi.rs.
export const bindAdapter = (
  driver: SqlDriver,
  errorRegistry = new ErrorRegistryInternal(),
): ErrorCapturingSqlDriver => {
  const boundAdapter: ErrorCapturingSqlDriver = {
    driverName: driver.driverName,
    errorRegistry,
    queryRaw: wrapAsync(errorRegistry, driver.queryRaw.bind(driver)),
    executeRaw: wrapAsync(errorRegistry, driver.executeRaw.bind(driver)),
    executeScript: wrapAsync(errorRegistry, driver.executeScript.bind(driver)),
    dispose: wrapAsync(errorRegistry, driver.dispose.bind(driver)),
    provider: driver.provider,
    startTransaction: async (...args) => {
      const ctx = await wrapAsync(errorRegistry, driver.startTransaction.bind(driver))(...args)
      return ctx.map((ctx) => bindTransaction(errorRegistry, ctx))
    },
  }

  if (driver.getConnectionInfo) {
    boundAdapter.getConnectionInfo = wrapSync(errorRegistry, driver.getConnectionInfo.bind(driver))
  }

  return boundAdapter
}

// *.bind(transaction) is required to preserve the `this` context of functions whose
// execution is delegated to napi.rs.
const bindTransaction = (errorRegistry: ErrorRegistryInternal, transaction: Transaction): ErrorCapturingTransaction => {
  return {
    driverName: transaction.driverName,
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
      debug('[error@wrapAsync]', error)

      // unwrap the cause of exceptions thrown by drivers if there is one
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
      debug('[error@wrapSync]', error)

      // unwrap the cause of exceptions thrown by drivers if there is one
      if (isDriverAdapterError(error)) {
        return err(error.cause)
      }
      const id = registry.registerNewError(error)
      return err({ kind: 'GenericJs', id })
    }
  }
}
