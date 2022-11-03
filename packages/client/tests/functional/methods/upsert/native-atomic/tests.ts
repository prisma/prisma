import { faker } from '@faker-js/faker'
// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import { NewPrismaClient } from '../../../_utils/types'
import testMatrix from './_matrix'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

class UpsertChecker {
  private logs: string[]

  constructor(client: PrismaClient) {
    this.logs = []
    this.capturelogs(client)
  }

  capturelogs(client: PrismaClient) {
    client.$on('query', (data) => {
      if ('query' in data) {
        this.logs.push(data.query)
      }
    })
  }

  usedNative() {
    const result = this.logs.some((log) => log.includes('ON CONFLICT'))

    // always clear the logs after asserting
    this.reset()

    return result
  }

  notUsedNative() {
    return !this.usedNative()
  }

  reset() {
    this.logs = []
  }
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

    afterEach(async () => {
      await client.post.deleteMany()
      await client.user.deleteMany()
      await client.compound.deleteMany()
    })

    test('should only use ON CONFLICT when update arguments do not have any nested queries', async () => {
      const name = faker.name.firstName()
      const title = faker.name.jobTitle()
      const title2 = faker.name.jobTitle()

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

      const checker = new UpsertChecker(client)

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
      expect(checker.notUsedNative()).toBeTruthy()

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
            create: {
              title: title2,
            },
          },
        },
      })
      expect(checker.notUsedNative()).toBeTruthy()

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
            update: {
              where: {
                title,
              },
              data: {
                title: `${title}-updated`,
              },
            },
          },
        },
      })

      expect(checker.notUsedNative()).toBeTruthy()

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
            delete: {
              title: title2,
            },
          },
        },
      })
      expect(checker.notUsedNative()).toBeTruthy()

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

      expect(checker.usedNative()).toBeTruthy()
    })

    test('should only use ON CONFLICT when there is only 1 unique field in the where clause', async () => {
      const name = faker.name.firstName()
      const title = faker.name.jobTitle()

      await expect(() =>
        // This will fail
        client.user.upsert({
          where: {
            // Because two unique fields are used
            id: 1,
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

      const checker = new UpsertChecker(client)

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

      expect(checker.usedNative()).toBeTruthy()
    })

    test('should only use ON CONFLICT when the unique field defined in where clause has the same value as defined in the create arguments', async () => {
      const name = faker.name.firstName()

      const checker = new UpsertChecker(client)

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

      expect(checker.notUsedNative()).toBeTruthy()

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

      expect(checker.usedNative()).toBeTruthy()
    })

    test('should perform an upsert using ON CONFLICT', async () => {
      const name = faker.name.firstName()

      const checker = new UpsertChecker(client)

      const user = await client.user.upsert({
        where: {
          name,
        },
        create: {
          name,
        },
        update: {
          name: `${name}-updated`,
        },
      })

      expect(user.name).toEqual(name)

      expect(checker.usedNative()).toBeTruthy()

      const userUpdated = await client.user.upsert({
        where: {
          name,
        },
        create: {
          name,
        },
        update: {
          name: `${name}-updated`,
        },
      })

      expect(userUpdated.name).toEqual(`${name}-updated`)
      expect(checker.usedNative()).toBeTruthy()
    })

    test('should perform an upsert using ON CONFLICT with id', async () => {
      const name = faker.name.firstName()

      const checker = new UpsertChecker(client)

      const user = await client.user.upsert({
        where: {
          id: '1',
        },
        create: {
          id: '1',
          name,
        },
        update: {
          name: `${name}-updated`,
        },
      })

      expect(user.name).toEqual(name)

      expect(checker.usedNative()).toBeTruthy()

      const userUpdated = await client.user.upsert({
        where: {
          name,
        },
        create: {
          name,
        },
        update: {
          name: `${name}-updated`,
        },
      })

      expect(userUpdated.name).toEqual(`${name}-updated`)
      expect(checker.usedNative()).toBeTruthy()
    })

    test('should perform an upsert using ON CONFLICT with compound id', async () => {
      const checker = new UpsertChecker(client)

      let compound = await client.compound.upsert({
        where: {
          id1_id2: {
            id1: 1,
            id2: '1',
          },
        },
        create: {
          id1: 1,
          id2: '1',
          field1: 2,
          field2: '2',
          val: 1,
        },
        update: {
          val: 2,
        },
      })

      expect(compound.val).toEqual(1)

      expect(checker.usedNative()).toBeTruthy()

      compound = await client.compound.upsert({
        where: {
          id1_id2: {
            id1: 1,
            id2: '1',
          },
        },
        create: {
          id1: 1,
          id2: '1',
          field1: 2,
          field2: '2',
          val: 1,
        },
        update: {
          val: 2,
        },
      })

      expect(compound.val).toEqual(2)
      expect(checker.usedNative()).toBeTruthy()
    })

    test('should perform an upsert using ON CONFLICT with compound uniques', async () => {
      const checker = new UpsertChecker(client)

      let compound = await client.compound.upsert({
        where: {
          uniques: {
            field1: 2,
            field2: '2',
          },
        },
        create: {
          id1: 1,
          id2: '1',
          field1: 2,
          field2: '2',
          val: 1,
        },
        update: {
          val: 2,
        },
      })

      expect(compound.val).toEqual(1)
      expect(checker.usedNative()).toBeTruthy()

      compound = await client.compound.upsert({
        where: {
          uniques: {
            field1: 2,
            field2: '2',
          },
        },
        create: {
          id1: 1,
          id2: '1',
          field1: 2,
          field2: '2',
          val: 1,
        },
        update: {
          val: 2,
        },
      })

      expect(compound.val).toEqual(2)
      expect(checker.usedNative()).toBeTruthy()
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
