export class PrismaClientKnownRequestError extends Error {
  code: string
  meta?: object
  clientVersion: string

  constructor(message: string, code: string, clientVersion: string, meta?: any) {
    super(message)

    this.code = code
    this.clientVersion = clientVersion
    this.meta = meta
  }
  get [Symbol.toStringTag]() {
    return 'PrismaClientKnownRequestError'
  }
}
