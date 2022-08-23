import { faker } from '@faker-js/faker'

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
                address: 'a',
              },
            },
          },
          {
            id: '2',
            name: 'bar',
            location: {
              set: {
                address: 'b',
              },
            },
          },
          {
            id: '3',
            name: 'foo',
            location: {
              set: {
                address: 'c',
              },
            },
          },
        ],
      })
    })

    test('should query the index and return correct data', async () => {
      const response = await prisma.a.findUnique({
        where: {
          name_address: {
            name: 'foo',
            location: {
              address: 'a',
            },
          },
        },
      })

      expect(response).toMatchObject({
        id: '1',
        name: 'foo',
        location: {
          address: 'a',
        },
      })
    })

    test('should throw runtime error when inserting duplicate', async () => {
      const location = {
        set: {
          address: faker.address.secondaryAddress(),
        },
      }

      const name = faker.name.firstName()

      await expect(async () => {
        await prisma.a.createMany({
          data: [
            {
              id: faker.random.numeric(100).toString(),
              name,
              location,
            },
            {
              id: faker.random.numeric(100).toString(),
              name,
              location,
            },
          ],
        })
      }).rejects.toThrowError('Unique constraint failed on the constraint: `A_name_location_address_key')
    })
  },
  {
    optOut: {
      from: ['sqlite', 'postgresql', 'sqlserver', 'mysql', 'cockroachdb'],
      reason: 'Composite Indices only work on Mongodb',
    },
  },
)
