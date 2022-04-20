import pRetry from 'p-retry'

import { getTestClient } from '../../../../../utils/getTestClient'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

let PrismaClient, prisma

const id = '8ccccccccccccccccccccccc'

/**
 * Test count operations on optional composite fields
 */
describeIf(!process.env.TEST_SKIP_MONGODB)('count > optional', () => {
  beforeAll(async () => {
    PrismaClient = await getTestClient('../')
    prisma = new PrismaClient()
  })

  beforeEach(async () => {
    await pRetry(
      async () => {
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
      },
      { retries: 2 },
    )
  })

  afterEach(async () => {
    await prisma.$disconnect()
  })

  /**
   * Simple count
   */
  test('count', async () => {
    const comment = await prisma.commentOptionalProp.count({
      where: { id },
      orderBy: {
        content: {
          upvotes: {
            _count: 'desc',
          },
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(`1`)
  })
})
