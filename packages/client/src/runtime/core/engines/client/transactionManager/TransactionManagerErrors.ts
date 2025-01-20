import { Error } from '@prisma/driver-adapter-utils'

import { PrismaClientKnownRequestError } from '../../../errors/PrismaClientKnownRequestError'

type ErrorParams = { clientVersion: string }

export class TransactionManagerError extends PrismaClientKnownRequestError {
  constructor(
    message: string,
    {
      clientVersion,
      meta,
    }: {
      clientVersion: string
      meta?: Record<string, unknown>
    },
  ) {
    super('Transaction API error: ' + message, {
      code: 'P2028',
      clientVersion,
      meta,
    })
  }
}

export class TransactionDriverAdapterError extends TransactionManagerError {
  constructor(message: string, errorParams: ErrorParams & { driverAdapterError: Error }) {
    // TODO: map all known non-transaction manager specific database based error codes properly - currently full mapping only exists in rust engine
    super(`Error from Driver Adapter: ${message}`, {
      clientVersion: errorParams.clientVersion,
      meta: {
        ...errorParams.driverAdapterError,
      },
    })
  }
}

export class TransactionNotFoundError extends TransactionManagerError {
  constructor(errorParams: ErrorParams) {
    super(
      "Transaction not found. Transaction ID is invalid, refers to an old closed transaction Prisma doesn't have information about anymore, or was obtained before disconnecting.",
      errorParams,
    )
  }
}

export class TransactionClosedError extends TransactionManagerError {
  constructor(operation: string, errorParams: ErrorParams) {
    super(`Transaction already closed: A ${operation} cannot be executed on a committed transaction`, errorParams)
  }
}

export class TransactionRolledBackError extends TransactionManagerError {
  constructor(operation: string, errorParams: ErrorParams) {
    super(`Transaction already closed: A ${operation} cannot be executed on a committed transaction`, errorParams)
  }
}

export class TransactionStartTimoutError extends TransactionManagerError {
  constructor(errorParams: ErrorParams) {
    super('Unable to start a transaction in the given time.', errorParams)
  }
}

export class TransactionExecutionTimeoutError extends TransactionManagerError {
  constructor(operation, { clientVersion, timeout, timeTaken }: ErrorParams & { timeout: number; timeTaken: number }) {
    super(
      `A ${operation} cannot be executed on an expired transaction. \
The timeout for this transaction was ${timeout} ms, however ${timeTaken} ms passed since the start \
of the transaction. Consider increasing the interactive transaction timeout \
or doing less work in the transaction`,
      { clientVersion },
    )
  }
}

export class TransactionInternalConsistencyError extends TransactionManagerError {
  constructor(message: string, errorParams: ErrorParams) {
    super(`Internal Consistency Error: ${message}`, errorParams)
  }
}

export class InvalidTransactionIsolationLevelError extends TransactionManagerError {
  constructor(isolationLevel: string, errorParams: ErrorParams) {
    super(`Invalid isolation level: ${isolationLevel}`, errorParams)
  }
}
