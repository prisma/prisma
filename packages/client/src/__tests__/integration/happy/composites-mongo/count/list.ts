import pRetry from 'p-retry'

import { getTestClient } from '../../../../../utils/getTestClient'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

let PrismaClient, prisma

const id = '7ccccccccccccccccccccccc'

/**
 * Test count operations on list composite fields
 */
describeIf(!process.env.TEST_SKIP_MONGODB)('count > list', () => {
  beforeAll(async () => {
    PrismaClient = await getTestClient('../')
    prisma = new PrismaClient()
  })

  beforeEach(async () => {
    await pRetry(
      async () => {
        await prisma.commentRequiredList.deleteMany({ where: { id } })
        await prisma.commentRequiredList.create({
          data: {
            id,
            country: 'France',
            contents: {
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
  test('simple', async () => {
    const comment = await prisma.commentRequiredList.count({
      where: { id },
      orderBy: {
        contents: {
          _count: 'asc',
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(`1`)
  })
})
