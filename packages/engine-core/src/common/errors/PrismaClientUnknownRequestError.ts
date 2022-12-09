import { ErrorWithBatchIndex } from './ErrorWithBatchIndex'

type UnknownErrorParams = {
  clientVersion: string
  batchRequestIdx?: number
}

export class PrismaClientUnknownRequestError extends Error implements ErrorWithBatchIndex {
  clientVersion: string
  batchRequestIdx?: number

  constructor(message: string, { clientVersion, batchRequestIdx }: UnknownErrorParams) {
    super(message)

    this.clientVersion = clientVersion
    this.batchRequestIdx = batchRequestIdx
  }
  get [Symbol.toStringTag]() {
    return 'PrismaClientUnknownRequestError'
  }
}
