import { PrismaClientInitializationError } from '@prisma/engine-core'

import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('should assert that the error has the listed properties', async () => {
      expect.assertions(5)

      try {
        await prisma.$connect()
      } catch (error) {
        const e = error as PrismaClientInitializationError
        expect(e.constructor.name).toEqual('PrismaClientInitializationError')
        expect(e.errorCode).toEqual('P1001')
        expect(e.clientVersion).toBeTruthy()
        expect(e.message).toBeTruthy()
        expect(e.name).toBeTruthy()
      } finally {
        await prisma.$disconnect()
      }
    })
  },
  { skipDb: true }, // So we can maually call connect for this test
)
