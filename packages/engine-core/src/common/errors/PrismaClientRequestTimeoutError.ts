export class PrismaClientRequestTimeoutError extends Error {
  clientVersion: string
  errorCode?: string

  constructor(clientVersion: string, message = 'Request to database timed out', errorCode?: string) {
    super(message)
    this.clientVersion = clientVersion
    this.errorCode = errorCode
    Error.captureStackTrace(PrismaClientRequestTimeoutError)
  }
  get [Symbol.toStringTag]() {
    return 'PrismaClientRequestTimeoutError'
  }
}
