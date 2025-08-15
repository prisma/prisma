import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('SELECT NULL works', async () => {
      const result = await prisma.$queryRaw`SELECT NULL AS result`
      expect(result).toEqual([{ result: null }])
    })
  },
  {
    optOut: {
      from: [Providers.MONGODB],
      reason: 'Raw SQL query requires an SQL database',
    },
    skipDriverAdapter: {
      from: ['js_pg_cockroachdb'],
      reason: "Failed to deserialize column of type 'unknown'",
    },
  },
)
