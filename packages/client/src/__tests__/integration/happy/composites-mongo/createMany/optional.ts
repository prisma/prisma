import pRetry from 'p-retry'

import { getTestClient } from '../../../../../utils/getTestClient'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

let PrismaClient, prisma

const id = '9aaaaaaaaaaaaaaaaaaaaaaa'

/**
 * Test createMany operations on optional composite fields
 */
describeIf(!process.env.TEST_SKIP_MONGODB)('createMany > optional', () => {
  beforeAll(async () => {
    PrismaClient = await getTestClient('..')
    prisma = new PrismaClient()
  })

  beforeEach(async () => {
    await pRetry(
      async () => {
        await prisma.commentOptionalProp.deleteMany({ where: { id } })
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
    const comment = await prisma.commentOptionalProp.createMany({
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
        count: 1,
      }
    `)
  })

  /**
   * Set shorthand
   */
  test('set shorthand', async () => {
    const comment = await prisma.commentOptionalProp.createMany({
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
        count: 1,
      }
    `)
  })

  /**
   * Set null
   */
  test('set null', async () => {
    const comment = await prisma.commentOptionalProp.createMany({
      data: {
        id,
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
    const comment = await prisma.commentOptionalProp.createMany({
      data: {
        id,
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
    const comment = await prisma.commentOptionalProp.createMany({
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
        count: 1,
      }
    `)
  })
})
