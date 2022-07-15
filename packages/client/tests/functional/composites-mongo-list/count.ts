import { faker } from '@faker-js/faker'
import pRetry from 'p-retry'

import { setupTestSuite } from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

const id = faker.database.mongodbObjectId()

setupTestSuite(() => {
  beforeAll(async () => {
    await pRetry(
      async () => {
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
      },
      { retries: 2 },
    )
  })

  /**
   * Simple count
   */
  test('simple', async () => {
    const count = await prisma.commentRequiredList.count({
      where: { id },
      orderBy: {
        contents: {
          _count: 'asc',
        },
      },
    })

    expect(count).toBe(1)
  })
})
