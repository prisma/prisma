import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

let prisma: PrismaClient
declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

/**
 * Regression test for https://github.com/prisma/prisma/issues/17810
 */
testMatrix.setupTestSuite(
  ({ provider }) => {
    beforeAll(() => {
      delete process.env[`DIRECT_DATABASE_URI_${provider}`]
      prisma = newPrismaClient()
    })

    test('doing a query', async () => {
      await prisma.user.findMany()
    })
  },
  {
    skipDefaultClientInstance: true,
  },
)
