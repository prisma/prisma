export enum IsolationLevel {
  ReadUncommitted = 'ReadUncommitted',
  ReadCommitted = 'ReadCommitted',
  RepeatableRead = 'RepeatableRead',
  Snapshot = 'Snapshot',
  Serializable = 'Serializable',
}

export type Options = {
  maxWait?: number
  timeout?: number
  isolationLevel?: IsolationLevel
}

export type TransactionInfo = {
  id: string
}
