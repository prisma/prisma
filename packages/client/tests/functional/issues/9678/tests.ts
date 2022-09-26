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
testMatrix.setupTestSuite(
  () => {
    test('concurrent deleteMany/createMany', async () => {
      const MAX_RETRIES = 5
      const fn = async () => {
        let retries = 0

        let result
        while (retries < MAX_RETRIES) {
          try {
            result = await prisma.$transaction(
              [prisma.resource.deleteMany({ where: { name: 'name' } }), prisma.resource.createMany({ data })],
              {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
              },
            )
            return result
          } catch (e) {
            if (e.code === 'P2034') {
              retries++
              continue
            }
            throw e
          }
        }
      }

      await Promise.all([fn(), fn(), fn(), fn(), fn()])
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mongodb'],
      reason: `
        sqlite - concurrent transactions are not supported
        mongo - isolation levels are not supported
      `,
    },
  },
)
