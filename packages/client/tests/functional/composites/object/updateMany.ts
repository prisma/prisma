import { faker } from '@faker-js/faker'

import { setupTestSuite } from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

setupTestSuite(({ contentProperty }) => {
  let id: string
  beforeEach(async () => {
    id = faker.database.mongodbObjectId()

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

  test('set', async () => {
    const comment = await prisma.comment.updateMany({
      where: { id },
      data: {
        country: 'Mars',
        content: {
          set: {
            text: 'Goodbye World',
            upvotes: {
              vote: false,
              userId: '42',
            },
          },
        },
      },
    })

    expect(comment).toEqual({ count: 1 })
  })

  test('set shorthand', async () => {
    const comment = await prisma.comment.updateMany({
      where: { id },
      data: {
        country: 'Mars',
        content: {
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
    const comment = prisma.comment.updateMany({
      where: { id },
      data: {
        country: 'France',
        content: {
          // @ts-test-if: contentProperty === 'optional'
          set: null,
        },
      },
    })

    if (contentProperty === 'optional') {
      expect(await comment).toEqual({ count: 1 })
    } else {
      await expect(comment).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Argument set for data.content.set must not be null'),
        }),
      )
    }
  })

  test('set null shorthand', async () => {
    const comment = prisma.comment.updateMany({
      where: { id },
      data: {
        country: 'France',
        // @ts-test-if: contentProperty === 'optional'
        content: null,
      },
    })

    if (contentProperty === 'optional') {
      expect(await comment).toEqual({ count: 1 })
    } else {
      await expect(comment).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Argument content for data.content must not be null'),
        }),
      )
    }
  })

  test('set nested list', async () => {
    const comment = await prisma.comment.updateMany({
      where: { id },
      data: {
        country: 'Mars',
        content: {
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

  describeIf(contentProperty === 'optional')('optional', () => {
    test('update', async () => {
      const comment = await prisma.comment.updateMany({
        where: { id },
        data: {
          content: {
            // @ts-test-if: contentProperty === 'optional'
            upsert: {
              update: {
                text: 'Goodbye World',
              },
              set: null,
            },
          },
        },
      })

      expect(comment).toEqual({ count: 1 })
    })

    test('update push nested list', async () => {
      const comment = await prisma.comment.updateMany({
        where: { id },
        data: {
          country: 'Mars',
          content: {
            // @ts-test-if: contentProperty === 'optional'
            upsert: {
              update: {
                upvotes: {
                  push: [{ userId: '11', vote: true }],
                },
              },
              set: null,
            },
          },
        },
      })

      expect(comment).toEqual({ count: 1 })
    })

    test('update set nested list', async () => {
      const comment = await prisma.comment.updateMany({
        where: { id },
        data: {
          country: 'Mars',
          content: {
            // @ts-test-if: contentProperty === 'optional'
            upsert: {
              update: {
                upvotes: {
                  set: [{ userId: '11', vote: true }],
                },
              },
              set: null,
            },
          },
        },
      })

      expect(comment).toEqual({ count: 1 })
    })
  })

  describeIf(contentProperty === 'required')('required', () => {
    test('update', async () => {
      const comment = await prisma.comment.updateMany({
        where: { id },
        data: {
          content: {
            // @ts-test-if: contentProperty === 'required'
            update: {
              text: 'Goodbye World',
            },
          },
        },
      })

      expect(comment).toEqual({ count: 1 })
    })

    test('update push nested list', async () => {
      const comment = await prisma.comment.updateMany({
        where: { id },
        data: {
          country: 'Mars',
          content: {
            // @ts-test-if: contentProperty === 'required'
            update: {
              upvotes: {
                push: [{ userId: '11', vote: true }],
              },
            },
          },
        },
      })

      expect(comment).toEqual({ count: 1 })
    })

    test('update set nested list', async () => {
      const comment = await prisma.comment.updateMany({
        where: { id },
        data: {
          country: 'Mars',
          content: {
            // @ts-test-if: contentProperty === 'required'
            update: {
              upvotes: {
                set: [{ userId: '11', vote: true }],
              },
            },
          },
        },
      })

      expect(comment).toEqual({ count: 1 })
    })
  })

  test('unset', async () => {
    const comment = prisma.comment.updateMany({
      where: { id },
      data: {
        content: {
          // @ts-test-if: contentProperty === 'optional'
          unset: true,
        },
      },
    })

    if (contentProperty === 'optional') {
      expect(await comment).toEqual({ count: 1 })
    } else {
      await expect(comment).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            'Unknown arg `unset` in data.content.unset for type CommentContentUpdateEnvelopeInput',
          ),
        }),
      )
    }
  })

  test('upsert set', async () => {
    const comment = prisma.comment.updateMany({
      where: { id },
      data: {
        content: {
          // @ts-test-if: contentProperty === 'optional'
          upsert: {
            update: {
              // TODO: validation error if removed
              text: 'Hello World update',
            },
            set: {
              text: 'Hello World new',
            },
          },
        },
      },
    })

    if (contentProperty === 'optional') {
      expect(await comment).toEqual({ count: 1 })
    } else {
      await expect(comment).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            'Unknown arg `upsert` in data.content.upsert for type CommentContentUpdateEnvelopeInput',
          ),
        }),
      )
    }
  })

  test('upsert update', async () => {
    const comment = prisma.comment.updateMany({
      where: { id },
      data: {
        content: {
          // @ts-test-if: contentProperty === 'optional'
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
            set: null,
          },
        },
      },
    })

    if (contentProperty === 'optional') {
      expect(await comment).toEqual({ count: 1 })
    } else {
      await expect(comment).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            'Unknown arg `upsert` in data.content.upsert for type CommentContentUpdateEnvelopeInput',
          ),
        }),
      )
    }
  })
})
