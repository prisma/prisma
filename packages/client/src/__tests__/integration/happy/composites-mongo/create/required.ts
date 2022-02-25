import { getTestClient } from '../../../../../utils/getTestClient'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

let PrismaClient, prisma

const id = 'aaaaaaaaaaaaaaaaaaaaaaaa'

/**
 * Test create operations on required composite fields
 */
describeIf(!process.env.TEST_SKIP_MONGODB)('create > required', () => {
  beforeAll(async () => {
    PrismaClient = await getTestClient('..')
    prisma = new PrismaClient()
  })

  beforeEach(async () => {
    await prisma.commentRequiredProp.deleteMany({ where: { id } })
  })

  afterEach(async () => {
    await prisma.$disconnect()
  })

  /**
   * Simple set
   */
  test('set', async () => {
    const comment = await prisma.commentRequiredProp.create({
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
        id: aaaaaaaaaaaaaaaaaaaaaaaa,
      }
    `)
  })

  /**
   * Set shorthand
   */
  test('set shorthand', async () => {
    const comment = await prisma.commentRequiredProp.create({
      data: {
        id,
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
        id: aaaaaaaaaaaaaaaaaaaaaaaa,
      }
    `)
  })

  /**
   * Set null
   */
  test('set null', async () => {
    const comment = prisma.commentRequiredProp.create({
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
    const comment = prisma.commentRequiredProp.create({
      data: {
        country: 'France',
        // @-ts-expect-error
        content: null,
      },
    })

    await expect(comment).rejects.toThrowError(
      expect.objectContaining({
        message: expect.stringContaining('Got invalid value null on prisma.createOneCommentRequiredProp'),
      }),
    )
  })

  /**
   * Set nested list
   */
  test('set nested list', async () => {
    const comment = await prisma.commentRequiredProp.create({
      data: {
        id,
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
        country: France,
        id: aaaaaaaaaaaaaaaaaaaaaaaa,
      }
    `)
  })
})
