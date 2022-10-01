import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('mongo raw queries should work in a sequential transaction', async () => {
      const result = await prisma.$transaction([
        prisma.$runCommandRaw({
          insert: 'TestModel',
          documents: [{ _id: 10, field: 'A' }],
        }),

        prisma.testModel.findRaw({
          filter: { _id: 10 },
        }),

        prisma.testModel.aggregateRaw({
          pipeline: [{ $match: { _id: 10 } }],
        }),
      ])

      expect(result).toEqual([{ n: 1, ok: 1 }, [{ _id: 10, field: 'A' }], [{ _id: 10, field: 'A' }]])
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mysql', 'postgresql', 'sqlserver', 'cockroachdb'],
      reason: 'findRaw, runCommandRaw and aggregateRaw are MongoDB-only APIs',
    },
  },
)
