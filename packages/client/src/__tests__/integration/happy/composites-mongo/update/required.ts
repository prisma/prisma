import { getTestClient } from '../../../../../utils/getTestClient'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

let PrismaClient, prisma

const id = 'cccccccccccccccccccccccc'

/**
 * Test update operations on required composite fields
 */
describeIf(!process.env.TEST_SKIP_MONGODB)('update > required', () => {
  beforeAll(async () => {
    PrismaClient = await getTestClient('..')
    prisma = new PrismaClient()
  })

  beforeEach(async () => {
    await prisma.commentRequiredProp.deleteMany({ where: { id } })
    await prisma.commentRequiredProp.create({
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

  afterEach(async () => {
    await prisma.$disconnect()
  })

  /**
   * Simple set
   */
  test('set', async () => {
    const comment = await prisma.commentRequiredProp.update({
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

    expect(comment).toMatchInlineSnapshot(`
      Object {
        content: Object {
          text: Goodbye World,
          upvotes: Array [
            Object {
              userId: 42,
              vote: false,
            },
          ],
        },
        country: Mars,
        id: cccccccccccccccccccccccc,
      }
    `)
  })

  /**
   * Set shorthand
   */
  test('set shorthand', async () => {
    const comment = await prisma.commentRequiredProp.update({
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

    expect(comment).toMatchInlineSnapshot(`
      Object {
        content: Object {
          text: Goodbye World,
          upvotes: Array [
            Object {
              userId: 42,
              vote: false,
            },
          ],
        },
        country: Mars,
        id: cccccccccccccccccccccccc,
      }
    `)
  })

  /**
   * Set null
   */
  test('set null', async () => {
    const comment = prisma.commentRequiredProp.update({
      where: { id },
      data: {
        country: 'France',
        // @-ts-expect-error
        content: {
          set: null,
        },
      },
    })

    await expect(comment).rejects.toThrowError(
      expect.objectContaining({
        message: expect.stringContaining('Argument set for data.content.set must not be null'),
      }),
    )
  })

  /**
   * Set null shorthand
   */
  test('set null shorthand', async () => {
    const comment = prisma.commentRequiredProp.update({
      where: { id },
      data: {
        country: 'France',
        // @-ts-expect-error
        content: null,
      },
    })

    await expect(comment).rejects.toThrowError(
      expect.objectContaining({
        message: expect.stringContaining('Argument content for data.content must not be null'),
      }),
    )
  })

  /**
   * Set nested list
   */
  test('set nested list', async () => {
    const comment = await prisma.commentRequiredProp.update({
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

    expect(comment).toMatchInlineSnapshot(`
      Object {
        content: Object {
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
        country: Mars,
        id: cccccccccccccccccccccccc,
      }
    `)
  })

  /**
   * Simple update
   */
  test('update', async () => {
    const comment = await prisma.commentRequiredProp.update({
      where: { id },
      data: {
        content: {
          update: {
            text: 'Goodbye World',
          },
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(`
      Object {
        content: Object {
          text: Goodbye World,
          upvotes: Array [
            Object {
              userId: 10,
              vote: true,
            },
          ],
        },
        country: France,
        id: cccccccccccccccccccccccc,
      }
    `)
  })

  /**
   * Update push nested list
   */
  test('update push nested list', async () => {
    const comment = await prisma.commentRequiredProp.update({
      where: { id },
      data: {
        country: 'Mars',
        content: {
          update: {
            upvotes: {
              push: [{ userId: '11', vote: true }],
            },
          },
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(`
      Object {
        content: Object {
          text: Hello World,
          upvotes: Array [
            Object {
              userId: 10,
              vote: true,
            },
            Object {
              userId: 11,
              vote: true,
            },
          ],
        },
        country: Mars,
        id: cccccccccccccccccccccccc,
      }
    `)
  })

  /**
   * Update push nested list
   */
  test('update set nested list', async () => {
    const comment = await prisma.commentRequiredProp.update({
      where: { id },
      data: {
        country: 'Mars',
        content: {
          update: {
            upvotes: {
              set: [{ userId: '11', vote: true }],
            },
          },
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(`
      Object {
        content: Object {
          text: Hello World,
          upvotes: Array [
            Object {
              userId: 11,
              vote: true,
            },
          ],
        },
        country: Mars,
        id: cccccccccccccccccccccccc,
      }
    `)
  })

  /**
   * Simple unset
   */
  test('unset', async () => {
    const comment = prisma.commentRequiredProp.update({
      where: { id },
      data: {
        content: {
          // @-ts-expect-error
          unset: true,
        },
      },
    })

    await expect(comment).rejects.toThrowError(
      expect.objectContaining({
        message: expect.stringContaining(
          'Unknown arg `unset` in data.content.unset for type CommentContentUpdateEnvelopeInput',
        ),
      }),
    )
  })

  /**
   * Simple upsert - set
   */
  test('upsert set', async () => {
    const comment = prisma.commentRequiredProp.update({
      where: { id },
      data: {
        content: {
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
          'Unknown arg `upsert` in data.content.upsert for type CommentContentUpdateEnvelopeInput',
        ),
      }),
    )
  })

  /**
   * Simple upsert - update
   */
  test('upsert update', async () => {
    const comment = prisma.commentRequiredProp.update({
      where: { id },
      data: {
        content: {
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
          'Unknown arg `upsert` in data.content.upsert for type CommentContentUpdateEnvelopeInput',
        ),
      }),
    )
  })
})
