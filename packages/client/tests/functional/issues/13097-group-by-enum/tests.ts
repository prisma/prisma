import { ProviderFlavors } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

/**
 * Regression test for #13097
 * groupBy on enum fields
 */
testMatrix.setupTestSuite(
  ({ provider, providerFlavor }) => {
    // TODO Inconsistent column data: List field did not return an Array from database. Type identifier was Enum(EnumId(2)). Value was Enum(Some('{A}')).
    $beforeAll({
      failIf: providerFlavor === ProviderFlavors.JS_PG || providerFlavor === ProviderFlavors.JS_NEON,
    })(async () => {
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

    // TODO Inconsistent column data: List field did not return an Array from database. Type identifier was Enum(EnumId(2)). Value was Enum(Some('{A}')).
    test('groupBy on enumValue field', async () => {
      const result = await prisma.resource.groupBy({
        by: ['enumValue'],
      })

      expect(result).toMatchInlineSnapshot(`
        [
          {
            enumValue: A,
          },
        ]
      `)
    })

    // TODO Inconsistent column data: List field did not return an Array from database. Type identifier was Enum(EnumId(2)). Value was Enum(Some('{A}')).
    test.failing('groupBy on enumArray field', async () => {
      const result = await prisma.resource.groupBy({
        // @ts-test-if: provider !== 'mysql'
        by: ['enumArray'],
      })

      expect(result).toMatchInlineSnapshot(`
        [
          {
            enumArray: [
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
