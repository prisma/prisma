import { Prisma } from './node_modules/@prisma/client'

export class PrismaRetryError extends Error {
  constructor() {
    super()
    this.name = 'PrismaRetryError'
  }
}

export const Retry = (): Prisma.Middleware => {
  return async (params, next) => {
    let retries = 0
    do {
      try {
        const result = await next(params)
        return result
      } catch (err) {
        if (err.code === 'P2034') {
          retries += 1
          continue
        }
        throw err
      }
    } while (retries < 5)
    throw new PrismaRetryError()
  }
}
