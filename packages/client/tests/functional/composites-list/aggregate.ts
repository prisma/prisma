import { faker } from '@faker-js/faker'

import { setupTestSuite } from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

const id = faker.database.mongodbObjectId()

setupTestSuite(() => {
  beforeAll(async () => {
    await prisma.commentRequiredList.create({
      data: {
        id,
        country: 'France',
        contents: {
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

  test('simple', async () => {
    const comment = await prisma.commentRequiredList.aggregate({
      where: { id },
      orderBy: {
        contents: {
          _count: 'asc',
        },
      },
      _count: true,
    })

    expect(comment).toEqual({
      _count: 1,
    })
  })
})
