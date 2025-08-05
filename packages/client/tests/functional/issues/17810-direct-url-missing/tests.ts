import { NewPrismaClient } from '../../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

let prisma: PrismaClient
declare const newPrismaClient: NewPrismaClient<PrismaClient, typeof PrismaClient>

/**
 * Regression test for https://github.com/prisma/prisma/issues/17810
 */
testMatrix.setupTestSuite(
  ({ provider }) => {
    beforeEach(() => {
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
