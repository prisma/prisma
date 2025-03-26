import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  ({ driverAdapter }) => {
    test('does not crash on large amount of items inserted', async () => {
      // The test times out if we try to create too many entries for D1 in our setup
      // each statement will be executed separately at the moment because it's not batching them into a transaction
      // so we lowered the number for D1 for now
      const numberOfEntries = driverAdapter === 'js_d1' ? 20_000 : 150_000

      const result = prisma.dictionary.create({
        data: {
          entries: {
            create: Array.from({ length: numberOfEntries }).map(() => ({
              term: 'foo',
            })),
          },
        },
      })

      await expect(result).resolves.not.toThrow()
    }, 120_000)
  },
  {
    optOut: {
      from: [Providers.SQLSERVER, Providers.MYSQL, Providers.POSTGRESQL, Providers.COCKROACHDB, Providers.MONGODB],
      reason: `
        This test is fairly slow and the issue it is testing is not provider-dependent.
        Just for the sake of keeping test times acceptable, we are testing it only on sqlite
      `,
    },
    skipDriverAdapter: {
      from: ['js_d1'],
      reason: 'https://github.com/prisma/team-orm/issues/1070',
    },
  },
)
