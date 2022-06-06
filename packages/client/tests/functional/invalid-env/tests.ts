import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(
  () => {
    beforeAll(() => {
      const env = require('./prisma/env.json')
      Object.assign(process.env, env)
    })

    test('test should throw PrismaClientInitializationError because invalid env', async () => {
      expect.assertions(1)

      try {
        await prisma.$connect()
      } catch (error) {
        expect(error.constructor.name).toEqual('PrismaClientInitializationError')
      } finally {
        prisma.$disconnect().catch(() => undefined)
      }
    })
  },
  { skipDb: true }, // So we can maually call connect for this test
)
