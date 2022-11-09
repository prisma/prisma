import { faker } from '@faker-js/faker'

import { setupTestSuite } from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

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
