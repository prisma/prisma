import { AdapterProviders, Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

// https://github.com/prisma/prisma/issues/11233
testMatrix.setupTestSuite(
  ({ provider, driverAdapter }) => {
    test('should not throw when using Prisma.empty inside $executeRaw', async () => {
      expect.assertions(1)

      let result: any

      try {
        result = await prisma.$executeRaw(Prisma.empty)
      } catch (error) {
        result = error
      }

      switch (provider) {
        case Providers.SQLITE:
          // TODO the error does not match to the usual one
          if (driverAdapter === AdapterProviders.JS_LIBSQL) {
            expect((result as Error).message).toContain(': not an error')
          } else if (driverAdapter === AdapterProviders.JS_D1) {
            expect((result as Error).message).toContain('D1_ERROR: No SQL statements detected.')
          } else {
            expect((result as Error).message).toContain('Raw query failed. Code: `21`. Message: `not an error`')
          }
          break
        case Providers.POSTGRESQL:
        case Providers.COCKROACHDB:
        case Providers.SQLSERVER:
          expect(result).toEqual(0)
          break

        case Providers.MYSQL:
          expect((result as Error).message).toContain('Raw query failed. Code: `1065`. Message: `Query was empty`')
          break

        default:
          throw new Error('invalid provider')
      }
    })

    test('should not throw when using Prisma.empty inside $queryRaw', async () => {
      expect.assertions(1)

      let result: any

      try {
        result = await prisma.$queryRaw(Prisma.empty)
      } catch (error) {
        result = error
      }

      switch (provider) {
        case Providers.SQLITE:
          // TODO the error does not match to the usual one
          if (driverAdapter === AdapterProviders.JS_LIBSQL) {
            expect((result as Error).message).toContain(': not an error')
          } else if (driverAdapter === AdapterProviders.JS_D1) {
            expect((result as Error).message).toContain('D1_ERROR: No SQL statements detected.')
          } else {
            expect((result as Error).message).toContain('Raw query failed. Code: `21`. Message: `not an error`')
          }
          break
        case Providers.POSTGRESQL:
        case Providers.COCKROACHDB:
        case Providers.SQLSERVER:
          expect(result).toEqual([])
          break

        case Providers.MYSQL:
          expect((result as Error).message).toContain('Raw query failed. Code: `1065`. Message: `Query was empty`')
          break

        default:
          throw new Error('invalid provider')
      }
    })
  },
  {
    optOut: {
      from: [Providers.MONGODB],
      reason: '$raw methods not allowed when using mongodb',
    },
  },
)
