export class TransactionManagerError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export class TransactionDriverAdapterError extends TransactionManagerError {
  constructor(message: string, info: any) {
    super(message + ' ' + JSON.stringify(info))
  }
}

export class TransactionNotFoundError extends TransactionManagerError {
  constructor() {
    super('Transaction not found. Might be already committed, rolled back or timed out.')
  }
}

export class TransactionClosedError extends TransactionManagerError {
  constructor(state: string) {
    super(`Transaction already closed with state: ${state}`)
  }
}

export class TransactionAlreadyCommittedError extends TransactionClosedError {
  constructor() {
    super('committed')
  }
}

export class TransactionRolledBackError extends TransactionClosedError {
  constructor() {
    super('rolled_back')
  }
}

export class TransactionTimedOutError extends TransactionClosedError {
  constructor() {
    super('timed out')
  }
}

export class TransactionInternalConsistencyError extends TransactionManagerError {
  constructor(message: string) {
    super(`Internal Consistency Error: ${message}`)
  }
}

export class InvalidTransactionIsolationLevelError extends TransactionManagerError {
  constructor(isolationLevel: string) {
    super(`Invalid isolation level: ${isolationLevel}`)
  }
}
