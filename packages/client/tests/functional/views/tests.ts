import { faker } from '@faker-js/faker'

import { Providers } from '../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  ({ provider }) => {
    const isMongoDb = provider === Providers.MONGODB

    const fakeUser = {
      id: isMongoDb ? faker.database.mongodbObjectId() : faker.string.alphanumeric(5),
      email: faker.internet.email(),
      name: faker.person.firstName(),
    }

    const fakeProfile = {
      id: isMongoDb ? faker.database.mongodbObjectId() : faker.string.alphanumeric(5),
      bio: faker.person.jobTitle(),
    }

    beforeAll(async () => {
      await prisma.user.create({
        data: {
          ...fakeUser,
          profile: {
            create: fakeProfile,
          },
        },
      })

      if (isMongoDb) {
        // alterStatement doesn't work with mongodb because
        // - no support for DbExecute
        // @ts-test-if: provider === Providers.MONGODB
        await prisma.$runCommandRaw({
          create: 'UserInfo',
          viewOn: 'User',
          pipeline: [
            {
              $lookup: {
                from: 'Profile',
                localField: '_id',
                foreignField: 'userId',
                as: 'ProfileData',
              },
            },
            {
              $project: {
                id: '$_id',
                email: 1,
                name: 1,
                bio: '$ProfileData.bio',
              },
            },
            { $unwind: '$bio' },
          ],
        })
      }
    })

    test('should simple query a view', async () => {
      const user = await prisma.userInfo.findFirst()
      expect(user?.id).toEqual(fakeUser.id)
    })

    test('should query a view with where', async () => {
      const users = await prisma.userInfo.findMany({
        where: {
          email: fakeUser.email,
        },
      })

      expect(users[0]).toBeDefined()

      expect(users[0]?.id).toEqual(fakeUser.id)
    })

    test('should query views with a related column', async () => {
      const user = await prisma.userInfo.findFirst({
        select: {
          bio: true, // related column
        },
      })

      expect(user?.bio).toEqual(fakeProfile.bio)
    })

    test('should require orderBy when take is provided in non-aggregation method', async () => {
      await expect(
        // @ts-expect-error
        prisma.userInfo.findMany({
          take: 1,
        }),
      ).rejects.toMatchPrismaErrorInlineSnapshot(`
        "
        Invalid \`prisma.userInfo.findMany()\` invocation in
        /client/tests/functional/views/tests.ts:0:0

          XX test('should require orderBy when take is provided in non-aggregation method', async () => {
          XX   await expect(
          XX     // @ts-expect-error
        → XX     prisma.userInfo.findMany({
                   take: 1,
                   ~~~~
                 + orderBy: UserInfoOrderByWithRelationInput[] | UserInfoOrderByWithRelationInput
                 })

        Argument \`orderBy\` is missing.
        Argument \`orderBy\` is required because argument \`take\` was provided."
      `)
    })

    test('should require orderBy when skip is provided in non-aggregation method', async () => {
      await expect(
        // @ts-expect-error
        prisma.userInfo.findMany({
          skip: 1,
        }),
      ).rejects.toMatchPrismaErrorInlineSnapshot(`
        "
        Invalid \`prisma.userInfo.findMany()\` invocation in
        /client/tests/functional/views/tests.ts:0:0

          XX test('should require orderBy when skip is provided in non-aggregation method', async () => {
          XX   await expect(
          XX     // @ts-expect-error
        → XX     prisma.userInfo.findMany({
                    skip: 1,
                    ~~~~
                  + orderBy: UserInfoOrderByWithRelationInput[] | UserInfoOrderByWithRelationInput
                  })

        Argument \`orderBy\` is missing.
        Argument \`orderBy\` is required because argument \`skip\` was provided."
      `)
    })

    test('should require orderBy when take is provided in groupBy', async () => {
      await expect(
        // @ts-expect-error
        prisma.userInfo.groupBy({
          by: ['name'],
          take: 1,
        }),
      ).rejects.toMatchInlineSnapshot(`
        "
        Invalid \`prisma.userInfo.groupBy()\` invocation in
        /client/tests/functional/views/tests.ts:0:0

          142 test('should require orderBy when take is provided in groupBy', async () => {
          143   await expect(
          144     // @ts-expect-error
        → 145     prisma.userInfo.groupBy({
                    select: {
                      name: true
                    },
                    by: [
                      "name"
                    ],
                    take: 1,
                    ~~~~
                  + orderBy: UserInfoOrderByWithAggregationInput[] | UserInfoOrderByWithAggregationInput
                  })

        Argument \`orderBy\` is missing.
        Argument \`orderBy\` is required because argument \`take\` was provided."
      `)
    })

    test('should require orderBy when skip is provided in groupBy', async () => {
      await expect(
        // @ts-expect-error
        prisma.userInfo.groupBy({
          by: ['name'],
          skip: 1,
        }),
      ).rejects.toMatchInlineSnapshot(`
        "
        Invalid \`prisma.userInfo.groupBy()\` invocation in
        /client/tests/functional/views/tests.ts:0:0

          174 test('should require orderBy when skip is provided in groupBy', async () => {
          175   await expect(
          176     // @ts-expect-error
        → 177     prisma.userInfo.groupBy({
                    select: {
                      name: true
                    },
                    by: [
                      "name"
                    ],
                    skip: 1,
                    ~~~~
                  + orderBy: UserInfoOrderByWithAggregationInput[] | UserInfoOrderByWithAggregationInput
                  })

        Argument \`orderBy\` is missing.
        Argument \`orderBy\` is required because argument \`skip\` was provided."
      `)
    })
  },
  {
    alterStatementCallback: (provider) => {
      if (provider === Providers.MYSQL) {
        return `
          CREATE VIEW UserInfo
          AS SELECT u.id, email, name, p.bio
          FROM User u
          LEFT JOIN Profile p ON u.id = p.userId
        `
      } else {
        return `
          CREATE VIEW "UserInfo"
          AS SELECT u.id, email, name, p.bio
          FROM "User" u
          LEFT JOIN "Profile" p ON u.id = p."userId"
        `
      }
    },
  },
)
