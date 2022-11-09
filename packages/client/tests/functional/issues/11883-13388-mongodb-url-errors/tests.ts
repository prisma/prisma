import { NewPrismaClient } from '../../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(
  () => {
    // TODO: temporary skipped because of the flakiness

    // https://github.com/prisma/prisma/issues/11883
    test.skip('unescaped slashes in password, causes the rest to be interpreted as database name', async () => {
      const prisma = newPrismaClient({
        datasources: {
          db: {
            url: 'mongodb://localhost:C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==@localhost:10255/e2e-tests?ssl=true',
          },
        },
      })

      await expect(prisma.$connect()).rejects.toThrowErrorMatchingInlineSnapshot(
        `The provided database string is invalid. MongoDB connection string error: illegal character in database name in database URL. Please refer to the documentation in https://www.prisma.io/docs/reference/database-reference/connection-urls for constructing a correct connection string. In some cases, certain characters must be escaped. Please check the string for any illegal characters.`,
      )
    })

    // https://github.com/prisma/prisma/issues/13388
    test.skip('mongodb+srv used together with a port', async () => {
      const prisma = newPrismaClient({
        datasources: {
          db: {
            url: 'mongodb+srv://root:example@localhost:27017/myDatabase',
          },
        },
      })

      await expect(prisma.$connect()).rejects.toThrowErrorMatchingInlineSnapshot(
        `The provided database string is invalid. MongoDB connection string error: a port cannot be specified with 'mongodb+srv' in database URL. Please refer to the documentation in https://www.prisma.io/docs/reference/database-reference/connection-urls for constructing a correct connection string. In some cases, certain characters must be escaped. Please check the string for any illegal characters.`,
      )
    })
  },
  {
    skipDb: true,
    skipDefaultClientInstance: true,
    optOut: {
      from: ['cockroachdb', 'mysql', 'postgresql', 'sqlite', 'sqlserver'],
      reason: 'Test for MongoDB-specific errors',
    },
    skipDataProxy: {
      runtimes: ['node', 'edge'],
      reason: `
        The test is not relevant for the Data Proxy. It is not possible to
        create a project with invalid connection string via PDP UI. If an
        invalid connection string somehow ended up saved for the project due to
        a bug in PDP, the behavior is unspecified. We could adapt this to be a
        contrived test tailor-made for mini-proxy (by importing mini-proxy API
        and programmatically generating mini-proxy connection strings pointing
        at broken URLs), but it would not reflect real use cases and would not
        bring much value.
      `,
    },
  },
)
