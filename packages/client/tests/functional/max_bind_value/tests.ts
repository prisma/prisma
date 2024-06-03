import testMatrix from './_matrix'
// @ts-ignore
import type { Post, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  const posts: Pick<Post, 'id'>[] = []
  const numberOfUsers = 20 // TODO: update after release

  beforeAll(async () => {
    // Create x users with 2 posts each
    for (let i = 0; i < numberOfUsers; i++) {
      await prisma.user.create({
        data: {
          email: `user${i}@example.com`,
          name: `User ${i}`,
          posts: {
            createMany: {
              data: [
                {
                  title: `Post ${i}a`,
                  content: `This is the content of the first post ${i}a by User ${i}`,
                },
                {
                  title: `Post ${i}b`,
                  content: `This is the content of the second post ${i}b by User ${i}`,
                },
              ],
            },
          },
        },
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    posts.push(...(await prisma.post.findMany({ select: { id: true } })))
  })

  // It used to error on D1 with
  // Error in performIO: Error: D1_ERROR: too many SQL variables at offset 395
  // see https://github.com/prisma/prisma/issues/23743
  test('findMany() with more than 98 users with nested include should succeed', async () => {
    await expect(
      prisma.user.findMany({
        include: {
          posts: true,
        },
      }),
    ).resolves.toHaveLength(numberOfUsers)
  })

  // It used to error on D1 with
  // Error in performIO: Error: D1_ERROR: Expression tree is too large (maximum depth 100)
  // see https://github.com/prisma/prisma/issues/23919
  test('create user with nested connect with more than 98 posts should succeed', async () => {
    await expect(
      prisma.user.create({
        data: {
          name: 'Foo',
          email: 'foo@bar.org',
          posts: {
            connect: posts.map((it) => ({ id: it.id })),
          },
        },
        include: {
          posts: true,
        },
      }),
    ).resolves.toMatchObject({
      id: expect.any(String),
      // ...
    })
  })
})
