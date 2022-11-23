import { ErrorWithBatchIndex } from './ErrorWithBatchIndex'

type KnownErrorParams = {
  code: string
  clientVersion: string
  meta?: Record<string, unknown>
  batchRequestIdx?: number
}

export class PrismaClientKnownRequestError extends Error implements ErrorWithBatchIndex {
  code: string
  meta?: Record<string, unknown>
  clientVersion: string
  batchRequestIdx?: number

  constructor(message: string, { code, clientVersion, meta, batchRequestIdx }: KnownErrorParams) {
    super(message)

    this.code = code
    this.clientVersion = clientVersion
    this.meta = meta
    this.batchRequestIdx = batchRequestIdx
  }
  get [Symbol.toStringTag]() {
    return 'PrismaClientKnownRequestError'
  }
}
