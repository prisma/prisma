import { faker } from '@faker-js/faker'
// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import { NewPrismaClient } from '../../../_utils/types'
import testMatrix from './_matrix'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

// When awaited will return the latest UPDATE statement
function createSQLPromise(client: PrismaClient) {
  return ((): Promise<string> =>
    new Promise((resolve) => {
      // @ts-expect-error
      client.$on('query', (data) => {
        if ('query' in data && data.query.includes('UPDATE')) {
          resolve(data.query)
        }
      })
    }))()
}

testMatrix.setupTestSuite(
  () => {
    let client: PrismaClient

    beforeAll(() => {
      client = newPrismaClient({
        log: [
          {
            emit: 'event',
            level: 'query',
          },
        ],
      })
    })

    test('should only use ON CONFLICT when update arguments do not have any nested queries', async () => {
      const name = faker.name.firstName()
      const title = faker.name.jobTitle()

      await client.user.create({
        data: {
          name,
          posts: {
            create: {
              title,
            },
          },
        },
      })

      let sqlPromise: Promise<string> = createSQLPromise(client)
      let doesSQLContainOnConflict = false

      // This will 'not' use ON CONFLICT
      await client.user.upsert({
        where: {
          name,
        },
        create: {
          name,
        },
        update: {
          name,
          // Because this is a nested mutation
          posts: {
            upsert: {
              where: { title },
              create: { title },
              update: { title },
            },
          },
        },
      })
      doesSQLContainOnConflict = (await sqlPromise).includes('ON CONFLICT')
      expect(doesSQLContainOnConflict).toEqual(false)

      sqlPromise = createSQLPromise(client)
      // This 'will' use ON CONFLICT
      await client.user.upsert({
        where: {
          name,
        },
        create: {
          name,
        },
        update: {
          name,
          // Because there is no nested mutation
        },
      })
      doesSQLContainOnConflict = (await sqlPromise).includes('ON CONFLICT')
      expect(doesSQLContainOnConflict).toEqual(true)
    })

    test('should only use ON CONFLICT when there is only 1 unique field in the where clause', async () => {
      const name = faker.name.firstName()
      const title = faker.name.jobTitle()

      const user = await client.user.create({
        data: {
          name,
          posts: {
            create: {
              title,
            },
          },
        },
      })

      await expect(() =>
        // This will fail
        client.user.upsert({
          where: {
            // Because two unique fields are used
            id: user.id,
            name,
          },
          create: {
            name,
          },
          update: {
            name,
          },
        }),
      ).rejects.toThrowError('Argument where of type UserWhereUniqueInput needs exactly one argument')

      const sqlPromise: Promise<string> = createSQLPromise(client)
      let doesSQLContainOnConflict = false

      // This 'will' use ON CONFLICT
      await client.user.upsert({
        where: {
          // Because only one unique field is used
          name,
        },
        create: {
          name,
        },
        update: {
          name,
        },
      })
      doesSQLContainOnConflict = (await sqlPromise).includes('ON CONFLICT')
      expect(doesSQLContainOnConflict).toEqual(true)
    })

    test('should only use ON CONFLICT when the unique field defined in where clause has the same value as defined in the create arguments', async () => {
      const name = faker.name.firstName()
      const title = faker.name.jobTitle()

      await client.user.create({
        data: {
          name,
          posts: {
            create: {
              title,
            },
          },
        },
      })

      let sqlPromise: Promise<string> = createSQLPromise(client)
      let doesSQLContainOnConflict = false

      // This will 'not' use ON CONFLICT
      await client.user.upsert({
        where: {
          name,
        },
        create: {
          // Because the the where 'name' is 'not' equal to the create 'name'
          name: name + '1',
        },
        update: {
          name: name + '1',
        },
      })
      doesSQLContainOnConflict = (await sqlPromise).includes('ON CONFLICT')
      expect(doesSQLContainOnConflict).toEqual(false)

      sqlPromise = createSQLPromise(client)
      // This 'will' use ON CONFLICT
      await client.user.upsert({
        where: {
          name,
        },
        create: {
          // Because the the where 'name' is 'equal' to the create 'name'
          name,
        },
        update: {
          name: name + '1',
        },
      })
      doesSQLContainOnConflict = (await sqlPromise).includes('ON CONFLICT')
      expect(doesSQLContainOnConflict).toEqual(true)
    })

    test('should perform an upsert using ON CONFLICT', async () => {
      const name = faker.name.firstName()
      const title = faker.name.jobTitle()

      await client.user.create({
        data: {
          name,
          posts: {
            create: {
              title,
            },
          },
        },
      })

      const sqlPromise: Promise<string> = createSQLPromise(client)
      let doesSQLContainOnConflict = false

      await client.user.upsert({
        where: {
          name,
        },
        create: {
          name,
        },
        update: {
          name,
        },
      })
      doesSQLContainOnConflict = (await sqlPromise).includes('ON CONFLICT')
      expect(doesSQLContainOnConflict).toEqual(true)
    })
  },
  {
    optOut: {
      from: ['mongodb', 'mysql', 'sqlserver'],
      reason: 'Other providers do not support native INSERT ... ON CONFLICT SET .. WHERE',
    },
    skipDefaultClientInstance: true,
  },
)
