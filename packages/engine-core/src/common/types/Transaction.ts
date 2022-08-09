export enum IsolationLevel {
  ReadUncommitted = 'ReadUncommitted',
  ReadCommitted = 'ReadCommitted',
  RepeatableRead = 'RepeatableRead',
  Snapshot = 'Snapshot',
  Serializable = 'Serializable',
}

/**
 * maxWait ?= 2000
 * timeout ?= 5000
 */
export type Options = {
  maxWait?: number
  timeout?: number
  isolationLevel?: IsolationLevel
}

export type Info = {
  id: string
}

export type TransactionHeaders = {
  traceparent?: string
}
