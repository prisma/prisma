import { getTestClient } from '../../../../../../utils/getTestClient'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

let PrismaClient, prisma

const id = '3bbbbbbbbbbbbbbbbbbbbbbb'

/**
 * Test upsert update operations on optional composite fields
 */
describeIf(!process.env.TEST_SKIP_MONGODB)('upsert > optional > update', () => {
  beforeAll(async () => {
    PrismaClient = await getTestClient('../../')
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
    const comment = await prisma.commentOptionalProp.upsert({
      where: { id },
      create: {},
      update: {
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
        id: 3bbbbbbbbbbbbbbbbbbbbbbb,
      }
    `)
  })

  /**
   * Set shorthand
   */
  test('set shorthand', async () => {
    const comment = await prisma.commentOptionalProp.upsert({
      where: { id },
      create: {},
      update: {
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
        id: 3bbbbbbbbbbbbbbbbbbbbbbb,
      }
    `)
  })

  /**
   * Set null
   */
  test('set null', async () => {
    const comment = await prisma.commentOptionalProp.upsert({
      where: { id },
      create: {},
      update: {
        country: 'France',
        content: {
          set: null,
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(`
      Object {
        content: null,
        country: France,
        id: 3bbbbbbbbbbbbbbbbbbbbbbb,
      }
    `)
  })

  /**
   * Set null shorthand
   */
  test('set null shorthand', async () => {
    const comment = await prisma.commentOptionalProp.upsert({
      where: { id },
      create: {},
      update: {
        country: 'France',
        content: null,
      },
    })

    expect(comment).toMatchInlineSnapshot(`
      Object {
        content: null,
        country: France,
        id: 3bbbbbbbbbbbbbbbbbbbbbbb,
      }
    `)
  })

  /**
   * Set nested list
   */
  test('set nested list', async () => {
    const comment = await prisma.commentOptionalProp.upsert({
      where: { id },
      create: {},
      update: {
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
        id: 3bbbbbbbbbbbbbbbbbbbbbbb,
      }
    `)
  })

  /**
   * Simple update
   */
  test('update', async () => {
    const comment = await prisma.commentOptionalProp.upsert({
      where: { id },
      create: {},
      update: {
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
        id: 3bbbbbbbbbbbbbbbbbbbbbbb,
      }
    `)
  })

  /**
   * Update push nested list
   */
  test('update push nested list', async () => {
    const comment = await prisma.commentOptionalProp.upsert({
      where: { id },
      create: {},
      update: {
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
        id: 3bbbbbbbbbbbbbbbbbbbbbbb,
      }
    `)
  })

  /**
   * Update push nested list
   */
  test('update set nested list', async () => {
    const comment = await prisma.commentOptionalProp.upsert({
      where: { id },
      create: {},
      update: {
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
        id: 3bbbbbbbbbbbbbbbbbbbbbbb,
      }
    `)
  })

  /**
   * Simple unset
   */
  test('unset', async () => {
    const comment = await prisma.commentOptionalProp.upsert({
      where: { id },
      create: {},
      update: {
        content: {
          unset: true,
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(`
      Object {
        content: null,
        country: France,
        id: 3bbbbbbbbbbbbbbbbbbbbbbb,
      }
    `)
  })

  /**
   * Simple upsert - set
   */
  test('upsert set', async () => {
    const comment = await prisma.commentOptionalProp.upsert({
      where: { id },
      create: {},
      update: {
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
        content: Object {
          text: Hello World,
          upvotes: Array [
            Object {
              userId: 10,
              vote: true,
            },
          ],
        },
        country: France,
        id: 3bbbbbbbbbbbbbbbbbbbbbbb,
      }
    `)
  })

  /**
   * Simple upsert - update
   */
  test('upsert update', async () => {
    const comment = await prisma.commentOptionalProp.upsert({
      where: { id },
      create: {},
      update: {
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
        content: Object {
          text: Hello World,
          upvotes: Array [
            Object {
              userId: 10,
              vote: true,
            },
            Object {
              userId: 10,
              vote: true,
            },
          ],
        },
        country: France,
        id: 3bbbbbbbbbbbbbbbbbbbbbbb,
      }
    `)
  })
})
