import { faker } from '@faker-js/faker'

import { setupTestSuite } from './_matrix'
import { commentListDataA } from './_testData'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

setupTestSuite(() => {
  let id
  beforeEach(async () => {
    id = faker.database.mongodbObjectId()
    await prisma.commentRequiredList.create({ data: commentListDataA(id) })
  })

  test('set', async () => {
    const comment = await prisma.commentRequiredList.updateMany({
      where: { id },
      data: {
        country: 'Mars',
        contents: {
          set: [
            {
              text: 'Goodbye World',
              upvotes: {
                vote: false,
                userId: '42',
              },
            },
          ],
        },
      },
    })

    expect(comment).toEqual({ count: 1 })
  })

  test('set shorthand', async () => {
    const comment = await prisma.commentRequiredList.updateMany({
      where: { id },
      data: {
        country: 'Mars',
        contents: {
          text: 'Goodbye World',
          upvotes: {
            vote: false,
            userId: '42',
          },
        },
      },
    })

    expect(comment).toEqual({ count: 1 })
  })

  test('set null', async () => {
    const comment = prisma.commentRequiredList.updateMany({
      where: { id },
      data: {
        country: 'France',
        // @ts-expect-error
        contents: {
          set: null,
        },
      },
    })

    await expect(comment).rejects.toThrowError(
      expect.objectContaining({
        message: expect.stringContaining('Argument set for data.contents.set must not be null'),
      }),
    )
  })

  test('set null shorthand', async () => {
    const comment = prisma.commentRequiredList.updateMany({
      where: { id },
      data: {
        country: 'France',
        // @ts-expect-error
        contents: null,
      },
    })

    await expect(comment).rejects.toThrowError(
      expect.objectContaining({
        message: expect.stringContaining('Argument contents for data.contents must not be null'),
      }),
    )
  })

  test('set nested list', async () => {
    const comment = await prisma.commentRequiredList.updateMany({
      where: { id },
      data: {
        country: 'Mars',
        contents: {
          set: {
            text: 'Goodbye World',
            upvotes: [
              { userId: '10', vote: false },
              { userId: '11', vote: false },
            ],
          },
        },
      },
    })

    expect(comment).toEqual({ count: 1 })
  })

  test('push', async () => {
    const comment = await prisma.commentRequiredList.updateMany({
      where: { id },
      data: {
        contents: {
          push: {
            text: 'Goodbye World',
          },
        },
      },
    })

    expect(comment).toEqual({ count: 1 })
  })

  test('updateMany', async () => {
    const comment = await prisma.commentRequiredList.updateMany({
      where: { id },
      data: {
        contents: {
          updateMany: {
            data: {
              upvotes: [{ userId: 'Another Comment', vote: true }],
            },
            where: {
              upvotes: {
                isEmpty: true,
              },
            },
          },
        },
      },
    })

    expect(comment).toEqual({ count: 1 })
  })

  test('deleteMany', async () => {
    const comment = await prisma.commentRequiredList.updateMany({
      where: { id },
      data: {
        contents: {
          deleteMany: {
            where: {
              upvotes: {
                isEmpty: true,
              },
            },
          },
        },
      },
    })

    expect(comment).toEqual({ count: 1 })
  })

  test('unset', async () => {
    const comment = prisma.commentRequiredList.updateMany({
      where: { id },
      data: {
        contents: {
          // @ts-expect-error
          unset: true,
        },
      },
    })

    await expect(comment).rejects.toThrowError(
      expect.objectContaining({
        message: expect.stringContaining(
          'Unknown arg `unset` in data.contents.unset for type CommentContentListUpdateEnvelopeInput',
        ),
      }),
    )
  })

  test('upsert set', async () => {
    const comment = prisma.commentRequiredList.updateMany({
      where: { id },
      data: {
        contents: {
          // @ts-expect-error
          upsert: {
            update: {},
            set: {
              text: 'Hello World',
            },
          },
        },
      },
    })

    await expect(comment).rejects.toThrowError(
      expect.objectContaining({
        message: expect.stringContaining(
          'Unknown arg `upsert` in data.contents.upsert for type CommentContentListUpdateEnvelopeInput',
        ),
      }),
    )
  })

  test('upsert update', async () => {
    const comment = prisma.commentRequiredList.updateMany({
      where: { id },
      data: {
        contents: {
          // @ts-expect-error
          upsert: {
            update: {
              text: 'Hello World',
              upvotes: {
                push: {
                  userId: '10',
                  vote: true,
                },
              },
            },
            set: {
              text: 'Hello World',
            },
          },
        },
      },
    })

    await expect(comment).rejects.toThrowError(
      expect.objectContaining({
        message: expect.stringContaining(
          'Unknown arg `upsert` in data.contents.upsert for type CommentContentListUpdateEnvelopeInput',
        ),
      }),
    )
  })
})
