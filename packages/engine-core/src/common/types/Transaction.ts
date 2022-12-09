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

export type Info<Payload = unknown> = {
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
