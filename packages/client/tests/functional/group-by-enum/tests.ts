import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

/**
 * Regression test for #13097
 * groupBy on enum fields
 */
testMatrix.setupTestSuite(
  ({ provider }, suiteMeta) => {
    beforeAll(async () => {
      if (provider !== 'mysql') {
        await prisma.resource.create({
          data: {
            enumValue: 'A',
            enumArray: ['A'],
          },
        })
      } else {
        await prisma.resource.create({
          data: {
            enumValue: 'A',
          },
        })
      }
    })

    test('groupBy on enumValue field', async () => {
      const result = await prisma.resource.groupBy({
        by: ['enumValue'],
      })

      expect(result).toMatchInlineSnapshot(`
        Array [
          Object {
            enumValue: A,
          },
        ]
      `)
    })

    testIf(provider !== 'mysql')('groupBy on enumArray field', async () => {
      const result = await prisma.resource.groupBy({
        by: ['enumArray'],
      })

      expect(result).toMatchInlineSnapshot()
    })
  },
  {
    optOut: {
      from: ['sqlite', 'sqlserver'],
      reason: "SQLite and SQLServer don't support enums",
    },
  },
)
