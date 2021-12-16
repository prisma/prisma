export interface PrismaClientErrorInfo {
  clientVersion: string
  cause?: Error
}

export abstract class PrismaClientError extends Error {
  public abstract name: string
  public abstract code: string
  public clientVersion: string
  public cause?: Error // like https://github.com/es-shims/error-cause

  constructor(message: string, info: PrismaClientErrorInfo) {
    super(message)

    this.clientVersion = info.clientVersion
    this.cause = info.cause
  }

  get [Symbol.toStringTag]() {
    return this.name
  }
}
