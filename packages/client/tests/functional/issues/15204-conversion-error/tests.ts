import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

// Regression test for https://github.com/prisma/prisma/issues/15204
testMatrix.setupTestSuite(
  ({ providerFlavor, fieldType }) => {
    test('should return a descriptive error', async () => {
      await prisma.$executeRaw`INSERT INTO "TestModel" ("id", "field") VALUES ("1", 1.84467440724388e+19)`

      if (providerFlavor === undefined) {
        await expect(prisma.testModel.findMany()).rejects.toThrow(
          expect.objectContaining({
            code: 'P2023',
            message: expect.stringContaining(
              `Inconsistent column data: Could not convert from \`BigDecimal(18446744072438800000)\` to \`${fieldType}\``,
            ),
          }),
        )
      } else {
        if (fieldType === 'Int') {
          await expect(prisma.testModel.findMany()).rejects.toThrow(
            expect.objectContaining({
              code: 'P2023',
              meta: {
                message: expect.stringContaining(`Conversion failed: number must be an integer in column 'field'`),
              },
            }),
          )
        } else {
          await expect(prisma.testModel.findMany()).rejects.toThrow(
            expect.objectContaining({
              code: 'P2023',
              message: expect.stringContaining(`Inconsistent column data: Conversion failed: number must be an i64`),
            }),
          )
        }
      }
    })
  },
  {
    optOut: {
      from: ['mysql', 'mongodb', 'sqlserver', 'postgresql', 'cockroachdb'],
      reason: 'SQLite-specific test',
    },
  },
)
