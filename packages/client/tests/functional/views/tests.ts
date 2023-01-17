import { faker } from '@faker-js/faker'
// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import testMatrix from './_matrix'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  (suiteConfig) => {
    const fakeUser = {
      id: suiteConfig.provider === 'mongodb' ? faker.database.mongodbObjectId() : faker.random.alphaNumeric(5),
      email: faker.internet.email(),
      name: faker.name.firstName(),
    }

    const fakeProfile = {
      id: suiteConfig.provider === 'mongodb' ? faker.database.mongodbObjectId() : faker.random.alphaNumeric(5),
      bio: faker.name.jobTitle(),
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
    })

    test('should simple query a view', async () => {
      const user = await prisma.userInfo.findFirst()
      expect(user.id).toEqual(fakeUser.id)
    })

    test('should query a view with where', async () => {
      const users = await prisma.userInfo.findMany({
        where: {
          email: fakeUser.email,
        },
      })

      expect(users[0]).toBeDefined()

      expect(users[0].id).toEqual(fakeUser.id)
    })

    test('should query views with a related column', async () => {
      const user = await prisma.userInfo.findFirst({
        select: {
          bio: true, // related column
        },
      })

      expect(user.bio).toEqual(fakeProfile.bio)
    })
  },
  {
    alterStatementCallback: (provider) => {
      if (provider === 'mongodb') {
        return `
          db.createView('UserInfo', 'User', [
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
          ])
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
