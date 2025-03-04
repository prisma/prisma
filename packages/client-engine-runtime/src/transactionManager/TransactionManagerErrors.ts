import type { Error as DriverAdapterError } from '@prisma/driver-adapter-utils'

export class TransactionManagerError extends Error {
  code = 'P2028'

  constructor(
    message: string,
    public meta?: Record<string, unknown>,
  ) {
    super(`Transaction API error: ${message}`)
  }
}

export class TransactionDriverAdapterError extends TransactionManagerError {
  constructor(message: string, errorParams: { driverAdapterError: DriverAdapterError }) {
    // TODO: map all known non-transaction manager specific database based error codes properly - currently full mapping only exists in rust engine
    super(`Error from Driver Adapter: ${message}`, { ...errorParams.driverAdapterError })
  }
}

export class TransactionNotFoundError extends TransactionManagerError {
  constructor() {
    super(
      "Transaction not found. Transaction ID is invalid, refers to an old closed transaction Prisma doesn't have information about anymore, or was obtained before disconnecting.",
    )
  }
}

export class TransactionClosedError extends TransactionManagerError {
  constructor(operation: string) {
    super(`Transaction already closed: A ${operation} cannot be executed on a committed transaction`)
  }
}

export class TransactionRolledBackError extends TransactionManagerError {
  constructor(operation: string) {
    super(`Transaction already closed: A ${operation} cannot be executed on a committed transaction`)
  }
}

export class TransactionStartTimoutError extends TransactionManagerError {
  constructor() {
    super('Unable to start a transaction in the given time.')
  }
}

export class TransactionExecutionTimeoutError extends TransactionManagerError {
  constructor(operation: string, { timeout, timeTaken }: { timeout: number; timeTaken: number }) {
    super(
      `A ${operation} cannot be executed on an expired transaction. \
The timeout for this transaction was ${timeout} ms, however ${timeTaken} ms passed since the start \
of the transaction. Consider increasing the interactive transaction timeout \
or doing less work in the transaction`,
      { operation, timeout, timeTaken },
    )
  }
}

export class TransactionInternalConsistencyError extends TransactionManagerError {
  constructor(message: string) {
    super(`Internal Consistency Error: ${message}`)
  }
}

export class InvalidTransactionIsolationLevelError extends TransactionManagerError {
  constructor(isolationLevel: string) {
    super(`Invalid isolation level: ${isolationLevel}`, { isolationLevel })
  }
}
