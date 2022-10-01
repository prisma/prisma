import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

// Regression test for https://github.com/prisma/prisma/issues/15204
testMatrix.setupTestSuite(
  () => {
    test('should return a descriptive error', async () => {
      await prisma.$executeRaw`INSERT INTO "TestModel" ("id", "field") VALUES ("1", 1.84467440724388e+19)`

      await expect(prisma.testModel.findMany()).rejects.toThrowError(
        expect.objectContaining({
          code: 'P2020',
          message: expect.stringContaining(
            'Value out of range for the type. Unable to convert BigDecimal value "18446744072438800000" to type i64',
          ),
        }),
      )
    })
  },
  {
    optOut: {
      from: ['mysql', 'mongodb', 'sqlserver', 'postgresql', 'cockroachdb'],
      reason: 'SQLite-specific test',
    },
  },
)
