// @ts-ignore
import crypto from 'crypto'

import testMatrix from './_matrix'
import { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

class PrismaRetryError extends Error {
  constructor() {
    super()
    this.name = 'PrismaRetryError'
  }
}

const Retry = (): Prisma.Middleware => {
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

const data = [
  { name: 'name', id: crypto.randomBytes(12).toString('hex') },
  { name: 'name', id: crypto.randomBytes(12).toString('hex') },
  { name: 'name', id: crypto.randomBytes(12).toString('hex') },
]

/**
 * Reproduction for issue #9678
 */
testMatrix.setupTestSuite(({ provider }) => {
  test('serialized deleteMany/createMany', async () => {
    const fn = async () => {
      await prisma.$transaction([
        prisma.resource.deleteMany({ where: { name: 'name' } }),
        prisma.resource.createMany({ data }),
      ])
    }

    for (let i = 0; i < 50; i++) {
      await fn()
    }
  })

  // no isolation levels for MongoDB
  testIf(provider !== 'mongodb')('concurrent deleteMany/createMany', async () => {
    const fn = async () => {
      prisma.$use(Retry())
      await prisma.$transaction(
        [prisma.resource.deleteMany({ where: { name: 'name' } }), prisma.resource.createMany({ data })],
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      )
    }

    await Promise.all([fn(), fn(), fn(), fn(), fn()])
  })
})
