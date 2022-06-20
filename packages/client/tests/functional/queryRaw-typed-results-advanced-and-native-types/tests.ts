import testMatrix from './_matrix'

// @ts-ignore
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(
  () => {
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

      const testModel = await prisma.$queryRaw`SELECT * FROM "TestModel"`

      expect(testModel).toEqual([
        {
          id: 1,
          json: { a: 'b' },
          string_list: ['1', 'a', '2', ''],
          bInt_list: [BigInt('-1234'), BigInt('1234')],
          date: new Date('2022-05-04T00:00:00.000Z'),
          time: new Date('1970-01-01T14:40:06.617Z'),
        },
      ])
    })
  },
  {
    optOut: {
      from: ['mongodb', 'mysql', 'sqlite', 'sqlserver'],
      reason: `
        $queryRaw only works on SQL based providers
        mySql: You have an error in your SQL syntax; check the manual that corresponds to your MariaDB server version for the right syntax to use near '"TestModel"'
        sqlite: The current connector does not support lists of primitive types
        sqlserver: The current connector does not support the Json type.
      `,
    },
  },
)
