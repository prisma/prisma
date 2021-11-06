export interface PrismaClientErrorInfo {
  cause?: Error
  clientVersion: string
}

export abstract class PrismaClientError extends Error {
  public abstract code: string
  public cause?: Error // like https://github.com/es-shims/error-cause
  public clientVersion: string

  constructor(message: string, info: PrismaClientErrorInfo) {
    super(message)

    this.name = 'PrismaClientError'
    this.cause = info.cause
    this.clientVersion = info.clientVersion
  }

  get [Symbol.toStringTag]() {
    return this.name
  }
}
