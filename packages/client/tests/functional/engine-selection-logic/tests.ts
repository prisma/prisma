import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta, clientMeta) => {
    const OLD_ENV = process.env

    beforeEach(() => {
      process.env = { ...OLD_ENV } // Make a copy
    })

    afterAll(() => {
      process.env = OLD_ENV // Restore old environment
    })

    testIf(clientMeta.dataProxy /** = --no-engine */)('--no-engine prevents from using the other engines', async () => {
      process.env[`DATABASE_URI_${suiteConfig.provider}`] = 'postgresql://postgres:password@localhost:5432/db'

      const prisma = newPrismaClient()
      const promise = prisma.$connect()

      // proof that the correct engine is used
      await expect(promise).rejects.toThrowErrorMatchingInlineSnapshot(`Datasource URL must use prisma:// protocol`)
    })

    // test that we can pass a prisma:// url when the tests is not run as a dataproxy
    testIf(!clientMeta.dataProxy)('prisma:// url works as expected even when --no-engine is not used', async () => {
      process.env[`DATABASE_URI_${suiteConfig.provider}`] = 'prisma://localhost:5432/db'

      const prisma = newPrismaClient()
      const promise = prisma.$connect()

      // proof that the correct engine is used
      await expect(promise).rejects.toThrowErrorMatchingInlineSnapshot(`No valid API key found in the datasource URL`)
    })
  },
  {
    skipDb: true,
    skipDefaultClientInstance: true,
  },
)
