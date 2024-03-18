import { faker } from '@faker-js/faker'

import { setupTestSuite } from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

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
