import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import { PrismaClient } from './node_modules/@prisma/client'

declare const newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(
  () => {
    test('instantiate works without failing', () => {
      newPrismaClient()
    })
  },
  {
    skipDefaultClientInstance: true,
    skipDb: true,
    skipDataProxy: {
      runtimes: ['node', 'edge'],
      reason: `
        Fails with Data Proxy: error is an instance of InvalidDatasourceError
        Datasource "db" references an environment variable "INVALID_DATABASE_URI" that is not set.
      `,
    },
  },
)
