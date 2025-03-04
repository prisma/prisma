import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  ({ provider }) => {
    function getAllEntries() {
      if (provider === Providers.MYSQL) {
        return prisma.$queryRaw`SELECT * FROM \`TestModel\`;`
      }
        return prisma.$queryRaw`SELECT * FROM "TestModel";`
    }

    test('query model with multiple fields', async () => {
      await prisma.testModel.create({
        data: {
          id: 1,
          json: { a: 'b' },
          string_list: ['1', 'a', '2', ''],
          bInt_list: [BigInt('-1234'), BigInt('1234')],
          date: new Date('2022-05-04T14:40:06.617Z'),
          time: new Date('2022-05-04T14:40:06.617Z'),
        },
      })

      const testModel = await getAllEntries()

      expect(testModel).toEqual([
        {
          id: 1,
          json: { a: 'b' },
          string_list: ['1', 'a', '2', ''],
          // TODO: replace with exact values and remove next 2 asserts after
          // https://github.com/facebook/jest/issues/11617 is fixed
          bInt_list: [expect.anything(), expect.anything()],
          date: new Date('2022-05-04T00:00:00.000Z'),
          time: new Date('1970-01-01T14:40:06.617Z'),
        },
      ])

      expect(testModel![0].bInt_list[0]).toEqual(BigInt('-1234'))
      expect(testModel![0].bInt_list[1]).toEqual(BigInt('1234'))
    })
  },
  {
    optOut: {
      from: ['mongodb', 'mysql', 'sqlite', 'sqlserver'],
      reason: `
        $queryRaw only works on SQL based providers
        mysql: error: Field "string_list" (String[]) in model "TestModel" can't be a list. The current connector does not support lists of primitive types. 
                      Field "bInt_list" (BigInt[]) in model "TestModel" can't be a list. The current connector does not support lists of primitive types.
        sqlite: The current connector does not support lists of primitive types
        sqlserver: The current connector does not support the Json type.
      `,
    },
  },
)
