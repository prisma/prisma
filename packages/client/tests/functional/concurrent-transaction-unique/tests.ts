// @ts-ignore
import crypto from 'crypto'

import testMatrix from './_matrix'
import { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

const data = [
  { name: 'name', id: crypto.randomBytes(12).toString('hex') },
  { name: 'name', id: crypto.randomBytes(12).toString('hex') },
  { name: 'name', id: crypto.randomBytes(12).toString('hex') },
]

/**
 * Reproduction for issue #9678
 */
testMatrix.setupTestSuite(({ provider }) => {
  testIf(provider !== 'sqlite')('serialized deleteMany/createMany', async () => {
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

  testIf(
    provider !== 'sqlite' && provider !== 'mongodb', // no isolation levels for MongoDB
  )('concurrent deleteMany/createMany', async () => {
    const fn = async () => {
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
