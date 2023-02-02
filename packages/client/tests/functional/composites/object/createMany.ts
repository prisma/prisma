import { setupTestSuite } from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

setupTestSuite(({ contentProperty }) => {
  test('set', async () => {
    const result = await prisma.comment.createMany({
      data: {
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

    expect(result).toEqual({ count: 1 })
  })

  test('set shorthand', async () => {
    const result = await prisma.comment.createMany({
      data: {
        country: 'France',
        content: {
          text: 'Hello World',
          upvotes: {
            vote: true,
            userId: '10',
          },
        },
      },
    })

    expect(result).toEqual({ count: 1 })
  })

  test('set null', async () => {
    const result = prisma.comment.createMany({
      data: {
        country: 'France',
        content: {
          // @ts-test-if: contentProperty === 'optional'
          set: null,
        },
      },
    })

    if (contentProperty === 'required') {
      await expect(result).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Argument set for data.0.content.set must not be null'),
        }),
      )
    } else {
      await expect(result).resolves.toEqual({ count: 1 })
    }
  })

  test('set null shorthand', async () => {
    const comment = prisma.comment.createMany({
      data: {
        country: 'France',
        // @ts-test-if: contentProperty === 'optional'
        content: null,
      },
    })

    if (contentProperty === 'required') {
      await expect(comment).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Got invalid value null on prisma.createManyComment'),
        }),
      )
    } else {
      await expect(comment).resolves.toEqual({ count: 1 })
    }
  })

  test('set nested list', async () => {
    const comment = await prisma.comment.createMany({
      data: {
        country: 'France',
        content: {
          set: {
            text: 'Hello World',
            upvotes: [
              { userId: '10', vote: true },
              { userId: '11', vote: true },
            ],
          },
        },
      },
    })

    expect(comment).toEqual({ count: 1 })
  })
})
