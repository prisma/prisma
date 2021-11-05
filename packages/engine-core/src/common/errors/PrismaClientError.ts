export type PrismaClientErrorInfo = { code: string; cause?: Error }

export abstract class PrismaClientError extends Error {
  public abstract code: string
  public cause?: Error // like https://github.com/es-shims/error-cause

  constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message)

    this.name = 'PrismaClientError'
    this.cause = cause
  }

  get [Symbol.toStringTag]() {
    return this.name
  }
}
