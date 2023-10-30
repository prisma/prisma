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
  newTxId?: string
}

export type InteractiveTransactionInfo<Payload = unknown> = {
  /**
   * Transaction ID returned by the query engine.
   */
  id: string

  /**
   * Arbitrary payload the meaning of which depends on the `Engine` implementation.
   * For example, `DataProxyEngine` needs to associate different API endpoints with transactions.
   * In `LibraryEngine` and `BinaryEngine` it is currently not used.
   */
  payload: Payload
}

export type TransactionHeaders = {
  traceparent?: string
}
