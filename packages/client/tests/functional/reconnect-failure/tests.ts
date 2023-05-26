import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare const newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(
  (_, __, ___, setupDatabase) => {
    test('example', async () => {
      const client = newPrismaClient()

      // Try sending a query without a spawned database
      await expect(client.user.findMany()).rejects.toThrow()

      // Spawn the database
      await setupDatabase()

      // Expect it to work
      await expect(client.user.findMany()).resolves.toEqual([])
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
      from: ['mongodb'],
      reason: 'First query does not fail even when database does not exist.',
    },
  },
)
