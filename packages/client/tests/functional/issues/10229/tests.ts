import { PrismaClientInitializationError } from '@prisma/engine-core'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/10229
testMatrix.setupTestSuite(
  () => {
    test('should assert that the error has the correct errorCode', async () => {
      expect.assertions(2)

      try {
        await prisma.$connect()
      } catch (error) {
        const e = error as PrismaClientInitializationError
        expect(e.constructor.name).toEqual('PrismaClientInitializationError')
        expect(e.errorCode).toEqual('P1001')
      } finally {
        prisma.$disconnect().catch(() => {})
      }
    })
  },
  {
    skipDb: true,
    optOut: {
      from: ['sqlite', 'mongodb', 'sqlserver'],
      reason: `
        sqlite: dont have a connection string'
        mongodb: times out and dont throw
        sqlserver: returns undefined
      `,
    },
  },
)
