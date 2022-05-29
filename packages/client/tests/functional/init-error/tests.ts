import { PrismaClientInitializationError } from '@prisma/engine-core'

import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(
  () => {
    // an example of how to query with the preloaded client
    test('should assert that the error has the listed properties on the type', async () => {
      expect.assertions(5)

      try {
        await prisma.$connect()
      } catch (error) {
        const e = error as PrismaClientInitializationError
        expect(e.errorCode).toBeTruthy()
        expect(e.clientVersion).toBeTruthy()
        expect(e.message).toBeTruthy()
        expect(e.name).toBeTruthy()
        expect(e.clientVersion).toBeTruthy()
      } finally {
        await prisma.$disconnect()
      }
    })
  },
  { skipDBSetup: true, skipDBTeardown: true }, // So we can maually call connect for this test
)
