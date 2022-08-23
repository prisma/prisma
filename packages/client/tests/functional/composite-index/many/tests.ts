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

    test('should query the index and return correct data', async () => {
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

    test('should throw index error when inserting duplicate', async () => {
      const person = { name: faker.name.firstName(), age: Number(faker.random.numeric()) }
      const location = { address: faker.address.secondaryAddress() }

      await expect(async () => {
        await prisma.a.createMany({
          data: [
            {
              id: faker.random.numeric(100).toString(),
              person,
              location,
            },
            {
              id: faker.random.numeric(100).toString(),
              person,
              location,
            },
          ],
        })
      }).rejects.toThrowError('Unique constraint failed on the constraint: `A_location_address_person_name_key`')
    })
  },
  {
    optOut: {
      from: ['sqlite', 'postgresql', 'sqlserver', 'mysql', 'cockroachdb'],
      reason: 'Composite Indices only work on Mongodb',
    },
  },
)
