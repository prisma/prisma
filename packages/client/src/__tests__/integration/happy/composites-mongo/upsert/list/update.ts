import pRetry from 'p-retry'

import { getTestClient } from '../../../../../../utils/getTestClient'
import { commentRequiredListDataB } from '../../__helpers__/build-data/commentRequiredListDataB'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

let PrismaClient, prisma

const id = '3ccccccccccccccccccccccc'

/**
 * Test update operations on list composite fields
 */
describeIf(!process.env.TEST_SKIP_MONGODB)('update > list', () => {
  beforeAll(async () => {
    PrismaClient = await getTestClient('../../')
    prisma = new PrismaClient()
  })

  beforeEach(async () => {
    await pRetry(
      async () => {
        await prisma.commentRequiredList.deleteMany({ where: { id } })
        await prisma.commentRequiredList.create({ data: commentRequiredListDataB(id) })
      },
      { retries: 2 },
    )
  })

  afterEach(async () => {
    await prisma.$disconnect()
  })

  /**
   * Simple set
   */
  test('set', async () => {
    const comment = await prisma.commentRequiredList.upsert({
      where: { id },
      create: {},
      update: {
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

    expect(comment).toMatchInlineSnapshot(`
      Object {
        contents: Array [
          Object {
            text: Goodbye World,
            upvotes: Array [
              Object {
                userId: 42,
                vote: false,
              },
            ],
          },
        ],
        country: Mars,
        id: 3ccccccccccccccccccccccc,
      }
    `)
  })

  /**
   * Set shorthand
   */
  test('set shorthand', async () => {
    const comment = await prisma.commentRequiredList.upsert({
      where: { id },
      create: {},
      update: {
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

    expect(comment).toMatchInlineSnapshot(`
      Object {
        contents: Array [
          Object {
            text: Goodbye World,
            upvotes: Array [
              Object {
                userId: 42,
                vote: false,
              },
            ],
          },
        ],
        country: Mars,
        id: 3ccccccccccccccccccccccc,
      }
    `)
  })

  /**
   * Set null
   */
  test('set null', async () => {
    const comment = prisma.commentRequiredList.upsert({
      where: { id },
      create: {},
      update: {
        country: 'France',
        // @-ts-expect-error
        contents: {
          set: null,
        },
      },
    })

    await expect(comment).rejects.toThrowError(
      expect.objectContaining({
        message: expect.stringContaining('Argument set for update.contents.set must not be null'),
      }),
    )
  })

  /**
   * Set null shorthand
   */
  test('set null shorthand', async () => {
    const comment = prisma.commentRequiredList.upsert({
      where: { id },
      create: {},
      update: {
        country: 'France',
        // @-ts-expect-error
        contents: null,
      },
    })

    await expect(comment).rejects.toThrowError(
      expect.objectContaining({
        message: expect.stringContaining('Argument contents for update.contents must not be null'),
      }),
    )
  })

  /**
   * Set nested list
   */
  test('set nested list', async () => {
    const comment = await prisma.commentRequiredList.upsert({
      where: { id },
      create: {},
      update: {
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

    expect(comment).toMatchInlineSnapshot(`
      Object {
        contents: Array [
          Object {
            text: Goodbye World,
            upvotes: Array [
              Object {
                userId: 10,
                vote: false,
              },
              Object {
                userId: 11,
                vote: false,
              },
            ],
          },
        ],
        country: Mars,
        id: 3ccccccccccccccccccccccc,
      }
    `)
  })

  /**
   * Simple push
   */
  test('push', async () => {
    const comment = await prisma.commentRequiredList.upsert({
      where: { id },
      create: {},
      update: {
        contents: {
          push: {
            text: 'Goodbye World',
          },
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(`
      Object {
        contents: Array [
          Object {
            text: Goodbye World,
            upvotes: Array [
              Object {
                userId: 11,
                vote: false,
              },
            ],
          },
          Object {
            text: Hello World,
            upvotes: Array [
              Object {
                userId: 10,
                vote: true,
              },
            ],
          },
          Object {
            text: Hello World,
            upvotes: Array [],
          },
          Object {
            text: Goodbye World,
            upvotes: Array [],
          },
        ],
        country: France,
        id: 3ccccccccccccccccccccccc,
      }
    `)
  })

  /**
   * Simple updateMany
   */
  test('updateMany', async () => {
    const comment = await prisma.commentRequiredList.upsert({
      where: { id },
      create: {},
      update: {
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

    expect(comment).toMatchInlineSnapshot(`
      Object {
        contents: Array [
          Object {
            text: Goodbye World,
            upvotes: Array [
              Object {
                userId: 11,
                vote: false,
              },
            ],
          },
          Object {
            text: Hello World,
            upvotes: Array [
              Object {
                userId: 10,
                vote: true,
              },
            ],
          },
          Object {
            text: Hello World,
            upvotes: Array [
              Object {
                userId: Another Comment,
                vote: true,
              },
            ],
          },
        ],
        country: France,
        id: 3ccccccccccccccccccccccc,
      }
    `)
  })

  /**
   * Simple deleteMany
   */
  test('deleteMany', async () => {
    const comment = await prisma.commentRequiredList.upsert({
      where: { id },
      create: {},
      update: {
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

    expect(comment).toMatchInlineSnapshot(`
      Object {
        contents: Array [
          Object {
            text: Goodbye World,
            upvotes: Array [
              Object {
                userId: 11,
                vote: false,
              },
            ],
          },
          Object {
            text: Hello World,
            upvotes: Array [
              Object {
                userId: 10,
                vote: true,
              },
            ],
          },
        ],
        country: France,
        id: 3ccccccccccccccccccccccc,
      }
    `)
  })

  /**
   * Simple unset
   */
  test('unset', async () => {
    const comment = prisma.commentRequiredList.upsert({
      where: { id },
      create: {},
      update: {
        contents: {
          // @-ts-expect-error
          unset: true,
        },
      },
    })

    await expect(comment).rejects.toThrowError(
      expect.objectContaining({
        message: expect.stringContaining(
          'Unknown arg `unset` in update.contents.unset for type CommentContentListUpdateEnvelopeInput',
        ),
      }),
    )
  })

  /**
   * Simple upsert - set
   */
  test('upsert set', async () => {
    const comment = prisma.commentRequiredList.upsert({
      where: { id },
      create: {},
      update: {
        contents: {
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
          'Unknown arg `upsert` in update.contents.upsert for type CommentContentListUpdateEnvelopeInput',
        ),
      }),
    )
  })

  /**
   * Simple upsert - update
   */
  test('upsert update', async () => {
    const comment = prisma.commentRequiredList.upsert({
      where: { id },
      create: {},
      update: {
        contents: {
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
          'Unknown arg `upsert` in update.contents.upsert for type CommentContentListUpdateEnvelopeInput',
        ),
      }),
    )
  })
})
