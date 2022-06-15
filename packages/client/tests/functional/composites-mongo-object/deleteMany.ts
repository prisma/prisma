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
      },
      { retries: 2 },
    )
  })

  test('delete', async () => {
    await prisma.comment.deleteMany({
      where: { id },
    })

    const count = await prisma.comment.count({
      where: { id },
    })

    expect(count).toBe(0)
  })
})
