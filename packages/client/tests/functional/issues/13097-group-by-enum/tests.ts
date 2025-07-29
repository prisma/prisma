import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

/**
 * Regression test for #13097
 * groupBy on enum fields
 */
testMatrix.setupTestSuite(
  ({ provider }) => {
    beforeAll(async () => {
      if (provider !== Providers.MYSQL) {
        await prisma.resource.create({
          data: {
            enumValue: 'A',
            // @ts-test-if: provider !== Providers.MYSQL
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
        [
          {
            "enumValue": "A",
          },
        ]
      `)
    })

    testIf(provider !== Providers.MYSQL)('groupBy on enumArray field', async () => {
      const result = await prisma.resource.groupBy({
        // @ts-test-if: provider !== Providers.MYSQL
        by: ['enumArray'],
      })

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "enumArray": [
              "A",
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
