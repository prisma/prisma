import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/4004
testMatrix.setupTestSuite(() => {
  test('should not throw error when updating fields on a many to many join table', async () => {
    const post = await prisma.post.create({
      data: {
        title: 'Hello World',
      },
    })

    expect(post).toMatchObject({
      authorId: null,
      content: null,
      createdAt: expect.any(Date),
      id: expect.any(String),
      published: false,
      title: 'Hello World',
      updatedAt: expect.any(Date),
      viewCount: 0,
    })

    await expect(
      prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test',
          posts: {
            connect: {
              id: post.id,
            },
          },
        },
      }),
    ).resolves.toMatchObject({
      email: 'test@example.com',
      id: expect.any(String),
      name: 'Test',
    })
  })
})
