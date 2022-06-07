import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite((suiteConfig, suiteMeta) => {
  test('example', () => {
      expect.fail('No test defined')
  })
})
