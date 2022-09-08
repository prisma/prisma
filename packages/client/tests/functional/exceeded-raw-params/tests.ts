import crypto from 'crypto'

import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

/**
 * Regression test for #9326
 * Prepared statement parameters exceeded
 */
testMatrix.setupTestSuite(
  ({ provider }) => {
    test('lots of raw parameters', async () => {
      let insertValues: PrismaNamespace.Sql

      if (provider === 'mysql') {
        insertValues = Prisma.sql`INSERT INTO \`Resource\` (\`id\`, \`field\`) VALUES ("${0}", ${0})`
      } else {
        insertValues = Prisma.sql`INSERT INTO "Resource" ("id", "field") VALUES ("${0}", ${0})`
      }

      for (let i = 1; i < 33000; i++) {
        insertValues = Prisma.join([insertValues, Prisma.sql`("${i}", ${0})`], ',')
      }

      const query = prisma.$executeRaw(insertValues)

      await expect(query).rejects.toMatchPrismaErrorSnapshot()
    })
  },
  {
    optOut: {
      from: ['mongodb', 'sqlite'],
      reason: '$executeRaw only works on SQL based providers, SQLite does not have raw parameters limits',
    },
  },
)
