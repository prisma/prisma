// @ts-ignore
import type { PrismaClient } from '@prisma/client'
// @ts-ignore
import type * as Sql from '@prisma/client/sql'

import testMatrix from './_matrix'

declare let prisma: PrismaClient
declare let sql: typeof Sql

testMatrix.setupTestSuite(
  () => {
    test('TypedSQL should work when a client extension of type query extension is used', async () => {
      const xprisma = prisma.$extends({
        query: {
          $allOperations({ query, args }) {
            return query(args)
          },
        },
      })

      const result = await xprisma.$queryRawTyped(sql.findAllTest())
      expect(result).toEqual([])
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'SQL dialect differs per database, focusing on PostgreSQL in this test',
    },
  },
)
