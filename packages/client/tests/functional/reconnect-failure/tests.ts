import { Providers } from '../_utils/providers'
import type { Db, NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare const newPrismaClient: NewPrismaClient<typeof PrismaClient>
declare const db: Db

let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('example', async () => {
      // Ensure that the db is down
      await db.dropDb()

      prisma = newPrismaClient()

      // Try sending a query without a spawned database
      await expect(prisma.user.findMany()).rejects.toThrow()

      // Spawn the database
      await db.setupDb()

      // Expect it to work
      await expect(prisma.user.findMany()).resolves.toEqual([])
    })
  },
  {
    skipDb: true, // So we can manually spawn the database
    skipDefaultClientInstance: true, // So we can manually call connect for this test
    skipDataProxy: {
      runtimes: ['node', 'edge'],
      reason: `
        Fails with Data Proxy: error is an instance of InvalidDatasourceError
        instead of Prisma.PrismaClientInitializationError.
      `,
    },
    optOut: {
      from: [Providers.MONGODB],
      reason: 'First query does not fail even when database does not exist.',
    },
  },
)
