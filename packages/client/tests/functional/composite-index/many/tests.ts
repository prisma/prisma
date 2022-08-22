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
            person: {
              name: 'foo',
              age: 1,
            },
            location: {
              address: 'a',
            },
          },
          {
            id: '2',
            person: {
              name: 'bar',
              age: 2,
            },
            location: {
              address: 'b',
            },
          },
          {
            id: '3',
            person: {
              name: 'foo',
              age: 3,
            },
            location: {
              address: 'c',
            },
          },
        ],
      })
    })

    test('composite-index many', async () => {
      const response = await prisma.a.findUnique({
        where: {
          location_address_person_name: {
            location: {
              address: 'a',
            },
            person: {
              name: 'foo',
            },
          },
        },
      })

      expect(response).toMatchObject({
        id: '1',
        location: {
          address: 'a',
        },
        person: {
          name: 'foo',
        },
      })
    })

    test('should throw runtime error if not all indexes are provided', async () => {
      await expect(
        async () =>
          await prisma.a.findUnique({
            where: {
              // @ts-expect-error
              location_address_person_name: {
                location: {
                  address: 'a',
                },
              },
            },
          }),
      ).rejects.toThrowError('Argument person for where.location_address_person_name.person is missing')
    })
  },
  {
    optOut: {
      from: ['sqlite', 'postgresql', 'sqlserver', 'mysql', 'cockroachdb'],
      reason: 'Composite Indices only work on Mongodb',
    },
  },
)
