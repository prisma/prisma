import { getTestClient } from '../../../../../utils/getTestClient'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

let PrismaClient, prisma

const id = '1bbbbbbbbbbbbbbbbbbbbbbb'

/**
 * Test updateMany operations on optional composite fields
 */
describeIf(!process.env.TEST_SKIP_MONGODB)('updateMany > optional', () => {
  beforeAll(async () => {
    PrismaClient = await getTestClient('..')
    prisma = new PrismaClient()
  })

  beforeEach(async () => {
    await prisma.commentOptionalProp.deleteMany({ where: { id } })
    await prisma.commentOptionalProp.create({
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
    const comment = await prisma.commentOptionalProp.updateMany({
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
        count: 1,
      }
    `)
  })

  /**
   * Set shorthand
   */
  test('set shorthand', async () => {
    const comment = await prisma.commentOptionalProp.updateMany({
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
        count: 1,
      }
    `)
  })

  /**
   * Set null
   */
  test('set null', async () => {
    const comment = await prisma.commentOptionalProp.updateMany({
      where: { id },
      data: {
        country: 'France',
        content: {
          set: null,
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(`
      Object {
        count: 1,
      }
    `)
  })

  /**
   * Set null shorthand
   */
  test('set null shorthand', async () => {
    const comment = await prisma.commentOptionalProp.updateMany({
      where: { id },
      data: {
        country: 'France',
        content: null,
      },
    })

    expect(comment).toMatchInlineSnapshot(`
      Object {
        count: 1,
      }
    `)
  })

  /**
   * Set nested list
   */
  test('set nested list', async () => {
    const comment = await prisma.commentOptionalProp.updateMany({
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
        count: 1,
      }
    `)
  })

  /**
   * Simple update
   */
  test('update', async () => {
    const comment = await prisma.commentOptionalProp.updateMany({
      where: { id },
      data: {
        content: {
          upsert: {
            update: {
              text: 'Goodbye World',
            },
            set: null,
          },
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(`
      Object {
        count: 1,
      }
    `)
  })

  /**
   * Update push nested list
   */
  test('update push nested list', async () => {
    const comment = await prisma.commentOptionalProp.updateMany({
      where: { id },
      data: {
        country: 'Mars',
        content: {
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

    expect(comment).toMatchInlineSnapshot(`
      Object {
        count: 1,
      }
    `)
  })

  /**
   * Update push nested list
   */
  test('update set nested list', async () => {
    const comment = await prisma.commentOptionalProp.updateMany({
      where: { id },
      data: {
        country: 'Mars',
        content: {
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

    expect(comment).toMatchInlineSnapshot(`
      Object {
        count: 1,
      }
    `)
  })

  /**
   * Simple unset
   */
  test('unset', async () => {
    const comment = await prisma.commentOptionalProp.updateMany({
      where: { id },
      data: {
        content: {
          unset: true,
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(`
      Object {
        count: 1,
      }
    `)
  })

  /**
   * Simple upsert - set
   */
  test('upsert set', async () => {
    const comment = await prisma.commentOptionalProp.updateMany({
      where: { id },
      data: {
        content: {
          upsert: {
            update: {
              // TODO: validation error if removed
              text: 'Hello World',
            },
            set: {
              text: 'Hello World',
            },
          },
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(`
      Object {
        count: 1,
      }
    `)
  })

  /**
   * Simple upsert - update
   */
  test('upsert update', async () => {
    const comment = await prisma.commentOptionalProp.updateMany({
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
            set: null,
          },
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(`
      Object {
        count: 1,
      }
    `)
  })
})
