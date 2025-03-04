import { faker } from '@faker-js/faker'
// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import { Providers } from '../_utils/providers'
import testMatrix from './_matrix'

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
                _id: 1,
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
      }
      return `
          CREATE VIEW "UserInfo" 
          AS SELECT u.id, email, name, p.bio
          FROM "User" u
          LEFT JOIN "Profile" p ON u.id = p."userId"
        `
    },
  },
)
