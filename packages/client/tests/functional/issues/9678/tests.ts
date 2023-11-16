// @ts-ignore
import crypto from 'crypto'

import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
import { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

const data = [
  { name: 'name', id: crypto.randomBytes(12).toString('hex') },
  { name: 'name', id: crypto.randomBytes(12).toString('hex') },
  { name: 'name', id: crypto.randomBytes(12).toString('hex') },
]

jest.retryTimes(3)

/**
 * Reproduction for issue #9678
 */
testMatrix.setupTestSuite(
  ({ provider }) => {
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
            // P2034 = Transaction failed due to a write conflict or a deadlock. Please retry your transaction
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
      // Before https://github.com/prisma/prisma-engines/pull/4249
      // The expectation for all providers that `hasRetried` would be set as `true`
      // It has changed for MySQL and SQL Server only
      // and also for cockroachdb, but not deterministic
      if (provider === Providers.COCKROACHDB) {
        // no expectation, it looks flaky
      } else if (provider === Providers.MYSQL || provider === Providers.SQLSERVER) {
        expect(hasRetried).toBe(false)
      } else {
        expect(hasRetried).toBe(true)
      }
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
