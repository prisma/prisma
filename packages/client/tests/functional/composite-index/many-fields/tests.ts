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
            location: {
              set: {
                street: 'a',
                zipCode: 'a',
                city: { name: 'paris' },
              },
            },
          },
          {
            id: '2',
            name: 'bar',
            location: {
              set: {
                street: 'b',
                zipCode: 'b',
                city: { name: 'paris' },
              },
            },
          },
          {
            id: '3',
            name: 'foo',
            location: {
              set: {
                street: 'c',
                zipCode: 'c',
                city: { name: 'paris' },
              },
            },
          },
        ],
      })
    })

    test('composite-index many fields', async () => {
      const response = await prisma.a.findUnique({
        where: {
          name_location_street_zipCode_city_name: {
            name: 'foo',
            location: {
              street: 'a',
              zipCode: 'a',
              city: {
                name: 'paris',
              },
            },
          },
        },
      })

      expect(response).toMatchObject({
        id: '1',
        name: 'foo',
        location: {
          street: 'a',
          zipCode: 'a',
          city: {
            name: 'paris',
          },
        },
      })
    })

    test('should throw runtime error if not all indexes are provided', async () => {
      await expect(
        async () =>
          await prisma.a.findUnique({
            where: {
              name_location_street_zipCode_city_name: {
                name: 'foo',
              },
            },
          }),
      ).rejects.toThrowError('Argument location for where.name_location_street_zipCode_city_name.location is missing')
    })
  },
  {
    optOut: {
      from: ['sqlite', 'postgresql', 'sqlserver', 'mysql', 'cockroachdb'],
      reason: 'Composite Indices only work on Mongodb',
    },
  },
)
