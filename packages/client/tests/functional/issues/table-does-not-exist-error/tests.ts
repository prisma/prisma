import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('returns P2021 error when querying a table that does not exist', async () => {
      const result = await prisma.user.findMany().catch((e) => e)

      expect(result.name).toBe('PrismaClientKnownRequestError')
      expect(result.code).toBe('P2021')
      expect(result.message).toContain('does not exist in the current database')
    })
  },
  {
    optOut: {
      from: ['mysql', 'cockroachdb', 'mongodb', 'sqlite', 'sqlserver'],
      reason: 'Testing PostgreSQL-specific table-not-found error with pg adapter and QPE',
    },
    alterStatementCallback: () => `DROP TABLE IF EXISTS "User";`,
  },
)
