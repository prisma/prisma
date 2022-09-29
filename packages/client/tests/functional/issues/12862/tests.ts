import { faker } from '@faker-js/faker'
import { ClientEngineType, getClientEngineType } from '@prisma/internals'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/12862
testMatrix.setupTestSuite(
  () => {
    if (getClientEngineType() !== ClientEngineType.Binary) {
      return
    }

    test('should propagate the correct error when a method fails inside an transaction', async () => {
      const user = await prisma.user.create({
        data: {
          email: faker.internet.email(),
          name: faker.name.firstName(),
        },
      })

      await expect(
        prisma.$transaction([
          prisma.post.create({
            data: {
              authorId: user.id,
              title: faker.lorem.sentence(),
              viewCount: -1, // should fail, must be >= 0
            },
          }),
        ]),
      ).rejects.toThrowError('violates check constraint \\"Post_viewCount_check\\"')
    })

    test('should propagate the correct error when a method fails inside an interactive transaction', async () => {
      await expect(
        prisma.$transaction(async (client) => {
          const user = await client.user.create({
            data: {
              email: faker.internet.email(),
              name: faker.name.firstName(),
            },
          })

          const post = await client.post.create({
            data: {
              authorId: user.id,
              title: faker.lorem.sentence(),
              viewCount: -1, // should fail, must be >= 0
            },
          })

          return post
        }),
      ).rejects.toThrowError('violates check constraint \\"Post_viewCount_check\\"')
    })
  },
  {
    optOut: {
      from: ['cockroachdb', 'mongodb', 'mysql', 'sqlite', 'sqlserver'],
      reason: 'bla',
    },
  },
)
