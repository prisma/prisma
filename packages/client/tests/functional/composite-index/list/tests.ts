import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(
  () => {
    beforeAll(async () => {
      await prisma.a.createMany({
        data: [
          {
            id: '1',
            name: 'foo',
            locations: {
              set: [
                {
                  address: 'a',
                },
                {
                  address: 'b',
                },
              ],
            },
          },
          {
            id: '2',
            name: 'bar',
            locations: {
              set: [
                {
                  address: 'c',
                },
              ],
            },
          },
        ],
      })
    })

    test('composite-index list', async () => {
      const response = await prisma.a.findUnique({
        where: {
          locations_address: {
            locations: {
              address: 'a',
            },
          },
        },
      })

      expect(response).toMatchObject({
        id: '1',
        name: 'foo',
        locations: [
          {
            address: 'a',
          },
          {
            address: 'b',
          },
        ],
      })
    })
  },
  {
    optOut: {
      from: ['sqlite', 'postgresql', 'sqlserver', 'mysql', 'cockroachdb'],
      reason: 'Composite Indices only work on Mongodb',
    },
  },
)
