import { Error as ErrorObject } from './types'

export class PrismaError extends Error {
  name = 'PrismaError'
  cause: ErrorObject

  constructor(payload: ErrorObject) {
    super(typeof payload['message'] === 'string' ? payload['message'] : payload.kind)
    this.cause = payload
  }
}
