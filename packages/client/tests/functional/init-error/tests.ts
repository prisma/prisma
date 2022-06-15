import { PrismaClientInitializationError } from '@prisma/engine-core'

import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

// https://github.com/prisma/prisma/issues/10229
testMatrix.setupTestSuite(
  ({ provider }) => {
    test('should assert that the error has the correct errorCode', async () => {
      expect.assertions(2)

      try {
        await prisma.$connect()
      } catch (error) {
        const e = error as PrismaClientInitializationError
        expect(e.constructor.name).toEqual('PrismaClientInitializationError')
        if (provider === 'sqlserver') {
          expect(e.errorCode).toEqual('P1012')
        } else {
          expect(e.errorCode).toEqual('P1001')
        }
      } finally {
        prisma.$disconnect().catch(() => {})
      }
    })
  },
  {
    skipDb: true,
    optOut: {
      from: ['sqlite', 'mongodb'],
      reason: `
        sqlite dont have a connection string'
        mongodb times out and dont throw
      `,
    },
  },
)
