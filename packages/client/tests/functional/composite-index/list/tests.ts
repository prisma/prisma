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

    test('should throw if a nested list is duplicate', async () => {
      const conflicting = {
        set: [
          {
            address: 'a',
          },
        ],
      }

      await expect(async () => {
        await prisma.a.createMany({
          data: [
            {
              id: '5',
              name: 'foo',
              locations: conflicting,
            },
            {
              id: '6',
              name: 'bar',
              locations: conflicting,
            },
          ],
        })
      }).rejects.toThrowError('Unique constraint failed on the constraint: `A_locations_address_key`')
    })
  },
  {
    optOut: {
      from: ['sqlite', 'postgresql', 'sqlserver', 'mysql', 'cockroachdb'],
      reason: 'Composite Indices only work on Mongodb',
    },
  },
)
