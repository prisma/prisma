import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

/**
 * Regression test for https://github.com/prisma/prisma/issues/17810
 */
testMatrix.setupTestSuite(({ provider }) => {
  beforeAll(() => {
    delete process.env[`DIRECT_DATABASE_URI_${provider}`]
  })

  test('doing a query', async () => {
    await prisma.user.findMany()
  })
})
