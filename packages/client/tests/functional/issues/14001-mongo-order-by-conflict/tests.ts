import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

/**
 * Regression test for #14001
 * Invalid character in mongo query
 */
testMatrix.setupTestSuite(
  () => {
    test('findFirst', async () => {
      const result = prisma.resource.findFirst({
        where: { OrderBy: { gt: 0 } },
        orderBy: { OrderBy: 'asc' },
        cursor: { OrderBy: 1 },
        distinct: ['OrderBy'],
      })

      await expect(result).resolves.toMatchInlineSnapshot(`null`)
    })

    test('findMany', async () => {
      const result = prisma.resource.findMany({
        where: { OrderBy: { gt: 0 } },
        orderBy: { OrderBy: 'asc' },
        cursor: { OrderBy: 1 },
        distinct: ['OrderBy'],
      })

      await expect(result).resolves.toMatchInlineSnapshot(`[]`)
    })

    test('aggregate', async () => {
      const result = prisma.resource.aggregate({
        where: { OrderBy: { gt: 0 } },
        _count: true,
        orderBy: { OrderBy: 'asc' },
        cursor: { OrderBy: 1 },
      })

      await expect(result).resolves.toMatchInlineSnapshot(`
        {
          _count: 0,
        }
      `)
    })

    test('groupBy', async () => {
      const result = prisma.resource.groupBy({
        where: { OrderBy: { gt: 0 } },
        by: ['OrderBy'],
        orderBy: { OrderBy: 'asc' },
        having: {
          OrderBy: 1,
        },
      })

      await expect(result).resolves.toMatchInlineSnapshot(`[]`)
    })
  },
  {
    optOut: {
      from: ['cockroachdb', 'mysql', 'postgresql', 'sqlite', 'sqlserver'],
      reason: 'Only a test for mongodb',
    },
  },
)
