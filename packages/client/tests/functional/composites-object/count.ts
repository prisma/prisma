import { faker } from '@faker-js/faker'

import { setupTestSuite } from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

const id = faker.database.mongodbObjectId()

setupTestSuite(() => {
  beforeAll(async () => {
    await prisma.comment.create({
      data: {
        id,
        country: 'France',
        content: {
          set: {
            text: 'Hello World',
            upvotes: {
              vote: true,
              userId: '10',
            },
          },
        },
      },
    })
  })

  /**
   * Simple count
   */
  test('count', async () => {
    const count = await prisma.comment.count({
      where: { id },
      orderBy: {
        content: {
          upvotes: {
            _count: 'desc',
          },
        },
      },
    })

    expect(count).toBe(1)
  })
})
