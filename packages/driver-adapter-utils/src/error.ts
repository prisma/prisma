import { Error as ErrorObject } from './types'

export class PrismaAdapterError extends Error {
  name = 'PrismaAdapterError'
  cause: ErrorObject

  constructor(payload: ErrorObject) {
    super(typeof payload['message'] === 'string' ? payload['message'] : payload.kind)
    this.cause = payload
  }
}
