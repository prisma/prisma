import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

/**
 * Regression test for #13097
 * groupBy on enum fields
 */
testMatrix.setupTestSuite(
  ({ provider }) => {
    beforeAll(async () => {
      if (provider !== 'mysql') {
        await prisma.resource.create({
          data: {
            enumValue: 'A',
            // @ts-test-if: provider !== 'mysql'
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

    /* eslint-disable jest/no-standalone-expect */
    testIf(provider !== 'mysql')('groupBy on enumArray field', async () => {
      const result = await prisma.resource.groupBy({
        // @ts-test-if: provider !== 'mysql'
        by: ['enumArray'],
      })

      expect(result).toMatchInlineSnapshot(`
        Array [
          Object {
            enumArray: Array [
              A,
            ],
          },
        ]
      `)
    })
  },
  {
    optOut: {
      from: ['sqlite', 'sqlserver'],
      reason: "SQLite and SQLServer don't support enums",
    },
  },
)
