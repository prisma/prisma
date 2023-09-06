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
  ({ provider, providerFlavor }) => {
    beforeEach(() => {
      const envVarName = providerFlavor ? `DIRECT_DATABASE_URI_${providerFlavor}` : `DIRECT_DATABASE_URI_${provider}`
      delete process.env[envVarName]
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
