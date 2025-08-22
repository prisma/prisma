import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

// Regression test for https://github.com/prisma/prisma/issues/15204
testMatrix.setupTestSuite(
  ({ driverAdapter, fieldType }) => {
    test('should return a descriptive error', async () => {
      await prisma.$executeRaw`INSERT INTO "TestModel" ("id", "field") VALUES (1, 1.84467440724388e+19)`

      if (driverAdapter === undefined || driverAdapter === 'js_d1') {
        await expect(prisma.testModel.findMany()).rejects.toThrow(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          expect.objectContaining({
            code: 'P2023',
            message: expect.stringContaining(
              `Inconsistent column data: Could not convert from \`BigDecimal(18446744072438800000)\` to \`${fieldType}\``,
            ),
          }),
        )
      } else {
        await expect(prisma.testModel.findMany()).rejects.toThrow(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          expect.objectContaining({
            code: 'P2023',
            message: expect.stringContaining(
              `Conversion failed: number must be an integer in column 'field', got '1.84467440724388e19'`,
            ),
          }),
        )
      }
    })
  },
  {
    optOut: {
      from: ['mysql', 'mongodb', 'sqlserver', 'postgresql', 'cockroachdb'],
      reason: 'SQLite-specific test',
    },
    skipDriverAdapter: {
      from: ['js_better_sqlite3', 'js_d1', 'js_libsql'],
      reason: 'Tracked in https://linear.app/prisma-company/issue/ORM-1362/fix-issues15204-conversion-error',
    },
  },
)
