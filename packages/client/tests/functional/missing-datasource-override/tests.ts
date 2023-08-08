// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from '@prisma/client'

import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'

declare const newPrismaClient: NewPrismaClient<typeof PrismaClient>
declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(
  () => {
    test('PrismaClientInitializationError for missing env', async () => {
      const prisma = newPrismaClient({
        datasources: {
          db: {},
        },
      })
      await expect(prisma.$connect()).rejects.toBeInstanceOf(Prisma.PrismaClientInitializationError)
      await expect(prisma.$connect()).rejects.toThrowErrorMatchingInlineSnapshot(
        `Datasource "db" was overridden in the constructor but the URL is "undefined".`,
      )
    })
  },
  {
    skipDb: true,
    skipDefaultClientInstance: true,
  },
)
