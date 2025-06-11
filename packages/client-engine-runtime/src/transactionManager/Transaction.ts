import type { IsolationLevel } from '@prisma/driver-adapter-utils'

export type Options = {
  /// Timeout for starting the transaction [ms]
  maxWait?: number

  /// Timeout for the transaction body [ms]
  timeout?: number

  /// Transaction isolation level
  isolationLevel?: IsolationLevel
  newTxId?: string
  label?: string
  parentId?: string
}

export type TransactionInfo = {
  id: string
}
