import crypto from 'crypto'

import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import { PrismaClient } from './node_modules/@prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>
let prisma: ReturnType<typeof newPrismaClient>

const data = [
  { name: 'name', id: crypto.randomBytes(12).toString('hex') },
  { name: 'name', id: crypto.randomBytes(12).toString('hex') },
  { name: 'name', id: crypto.randomBytes(12).toString('hex') },
]

/**
 * Reproduction for issue #9678
 */
testMatrix.setupTestSuite(
  ({ provider }) => {
    beforeAll(() => {
      prisma = newPrismaClient({ log: [{ emit: 'event', level: 'query' }] })

      // prisma.$on('query', (e) => console.log(e))
    })

    testIf(provider !== 'sqlite')('serialized deleteMany/createMany', async () => {
      const fn = async () => {
        await prisma.$transaction([
          prisma.resource.deleteMany({ where: { name: 'name' } }),
          prisma.resource.createMany({ data }),
        ])
      }

      for (let i = 0; i < 100; i++) {
        await fn()
      }
    })

    testIf(provider !== 'sqlite')('concurrent deleteMany/createMany', async () => {
      const fn = async () => {
        await prisma.$transaction([
          prisma.resource.deleteMany({ where: { name: 'name' } }),
          prisma.resource.createMany({ data }),
        ])
      }

      await Promise.all([fn(), fn(), fn(), fn(), fn()])
    })
  },
  {
    skipDefaultClientInstance: true,
  },
)
