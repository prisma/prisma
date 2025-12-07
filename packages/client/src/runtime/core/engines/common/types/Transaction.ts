import { type IsolationLevel } from '@prisma/json-protocol'

export { type IsolationLevel }

export type Options = {
  /** Timeout for starting the transaction */
  maxWait?: number

  /** Timeout for the transaction body */
  timeout?: number

  /** Transaction isolation level */
  isolationLevel?: IsolationLevel
}

export type InteractiveTransactionInfo<Payload = unknown> = {
  /**
   * Transaction ID returned by the query engine.
   */
  id: string

  /**
   * Arbitrary payload the meaning of which depends on the `Engine` implementation.
   * It is currently not used in `LibraryEngine`.
   */
  payload: Payload
}

export type TransactionHeaders = {
  traceparent?: string
}
