/**
 * maxWait ?= 2000
 * timeout ?= 5000
 */
export type Options = {
  maxWait?: number
  timeout?: number
}

export type Info = {
  id: string
}

export type TransactionHeaders = {
  traceparent?: string
}
