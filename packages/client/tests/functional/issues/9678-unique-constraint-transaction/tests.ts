// @ts-ignore
import { Prisma as PrismaNamespace, PrismaClient } from '@prisma/client'
import crypto from 'crypto'

import testMatrix from './_matrix'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

const data = [
  { name: 'name', id: crypto.randomBytes(12).toString('hex') },
  { name: 'name', id: crypto.randomBytes(12).toString('hex') },
  { name: 'name', id: crypto.randomBytes(12).toString('hex') },
]

jest.retryTimes(3)

// https://github.com/prisma/prisma/issues/9678
testMatrix.setupTestSuite(
  () => {
    test('concurrent deleteMany/createMany', async () => {
      let hasRetried = false
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
              hasRetried = true
              retries++
              continue
            }
            throw e
          }
        }
      }

      await Promise.all([fn(), fn(), fn(), fn(), fn(), fn(), fn(), fn(), fn(), fn()])
      expect(hasRetried).toBe(true)
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
