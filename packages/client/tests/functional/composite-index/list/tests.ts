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

    test('should query the index and return correct data', async () => {
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

    test('should throw index error when inserting duplicate', async () => {
      const locations = {
        set: [
          {
            address: faker.address.secondaryAddress(),
          },
        ],
      }

      await expect(async () => {
        await prisma.a.createMany({
          data: [
            {
              id: faker.random.numeric(100).toString(),
              name: 'foo',
              locations,
            },
            {
              id: faker.random.numeric(100).toString(),
              name: 'bar',
              locations,
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
