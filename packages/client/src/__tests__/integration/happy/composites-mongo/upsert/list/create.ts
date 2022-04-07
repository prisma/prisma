import pRetry from 'p-retry'

import { getTestClient } from '../../../../../../utils/getTestClient'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

let PrismaClient, prisma

const id = '2ccccccccccccccccccccccc'

/**
 * Test upsert create operations on list composite fields
 */
describeIf(!process.env.TEST_SKIP_MONGODB)('upsert > list > create', () => {
  beforeAll(async () => {
    PrismaClient = await getTestClient('../../')
    prisma = new PrismaClient()
  })

  beforeEach(async () => {
    await pRetry(
      async () => {
        await prisma.commentRequiredList.deleteMany({ where: { id } })
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
      update: {},
      create: {
        id,
        country: 'France',
        contents: {
          set: [
            {
              text: 'Hello World',
              upvotes: {
                vote: true,
                userId: '10',
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
        id: 2ccccccccccccccccccccccc,
      }
    `)
  })

  /**
   * Set shorthand
   */
  test('set shorthand', async () => {
    const comment = await prisma.commentRequiredList.upsert({
      where: { id },
      update: {},
      create: {
        id,
        country: 'France',
        contents: {
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
        contents: Array [
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
        id: 2ccccccccccccccccccccccc,
      }
    `)
  })

  /**
   * Set null
   */
  test('set null', async () => {
    const comment = prisma.commentRequiredList.upsert({
      where: { id },
      update: {},
      create: {
        country: 'France',
        // @-ts-expect-error
        contents: {
          set: null,
        },
      },
    })

    await expect(comment).rejects.toThrowError(
      expect.objectContaining({
        message: expect.stringContaining('Argument set for create.contents.set must not be null'),
      }),
    )
  })

  /**
   * Set null shorthand
   */
  test('set null shorthand', async () => {
    const comment = prisma.commentRequiredList.upsert({
      where: { id },
      update: {},
      create: {
        country: 'France',
        // @-ts-expect-error
        contents: null,
      },
    })

    await expect(comment).rejects.toThrowError(
      expect.objectContaining({
        message: expect.stringContaining('Argument contents for create.contents must not be null'),
      }),
    )
  })

  /**
   * Set nested list
   */
  test('set nested list', async () => {
    const comment = await prisma.commentRequiredList.upsert({
      where: { id },
      update: {},
      create: {
        id,
        country: 'France',
        contents: {
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
        contents: Array [
          Object {
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
        ],
        country: France,
        id: 2ccccccccccccccccccccccc,
      }
    `)
  })
})
