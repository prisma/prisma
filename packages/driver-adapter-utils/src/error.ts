import type { Error as ErrorObject } from './types'

export class DriverAdapterError extends Error {
  name = 'DriverAdapterError'
  cause: ErrorObject

  constructor(payload: ErrorObject) {
    super(typeof payload.message === 'string' ? payload.message : payload.kind)
    this.cause = payload
  }
}

export function isDriverAdapterError(error: {}): error is DriverAdapterError {
  return error.name === 'DriverAdapterError' && typeof error.cause === 'object'
}
