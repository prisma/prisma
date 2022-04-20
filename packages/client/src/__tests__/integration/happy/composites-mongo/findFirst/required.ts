import pRetry from 'p-retry'

import { getTestClient } from '../../../../../utils/getTestClient'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

let PrismaClient, prisma

const id = '2aaaaaaaaaaaaaaaaaaaaaaa'

/**
 * Test findFirst operations on required composite fields
 */
describeIf(!process.env.TEST_SKIP_MONGODB)('findFirst > required', () => {
  beforeAll(async () => {
    PrismaClient = await getTestClient('../')
    prisma = new PrismaClient()
  })

  beforeEach(async () => {
    await pRetry(
      async () => {
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
      },
      { retries: 2 },
    )
  })

  afterEach(async () => {
    await prisma.$disconnect()
  })

  /**
   * Simple find
   */
  test('find', async () => {
    const comment = await prisma.commentRequiredProp.findFirst({
      where: { id },
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
        id: 2aaaaaaaaaaaaaaaaaaaaaaa,
      }
    `)
  })

  /**
   * Select
   */
  test('select', async () => {
    const comment = await prisma.commentRequiredProp.findFirst({
      where: { id },
      select: {
        content: {
          select: {
            text: true,
          },
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(`
      Object {
        content: Object {
          text: Hello World,
        },
      }
    `)
  })

  /**
   * Order by
   */
  test('orderBy', async () => {
    const comment = await prisma.commentRequiredProp.findFirst({
      where: { id },
      orderBy: {
        content: {
          upvotes: {
            _count: 'desc',
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
        id: 2aaaaaaaaaaaaaaaaaaaaaaa,
      }
    `)
  })
})
