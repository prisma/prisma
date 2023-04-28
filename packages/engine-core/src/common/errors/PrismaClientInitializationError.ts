export class PrismaClientInitializationError extends Error {
  clientVersion: string
  errorCode?: string
  retryable?: boolean

  constructor(message: string, clientVersion: string, errorCode?: string) {
    super(message)
    this.clientVersion = clientVersion
    this.errorCode = errorCode
    Error.captureStackTrace(PrismaClientInitializationError)
  }
  get [Symbol.toStringTag]() {
    return 'PrismaClientInitializationError'
  }
}
