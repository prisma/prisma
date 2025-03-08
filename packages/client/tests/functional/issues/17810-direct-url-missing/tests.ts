// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import type { NewPrismaClient } from '../../_utils/types'
import testMatrix from './_matrix'

let prisma: PrismaClient
declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

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
