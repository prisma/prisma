import pRetry from 'p-retry'

import { getTestClient } from '../../../../../utils/getTestClient'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

let PrismaClient, prisma

const id = '6bbbbbbbbbbbbbbbbbbbbbbb'

/**
 * Test delete operations on list composite fields
 */
describeIf(!process.env.TEST_SKIP_MONGODB)('delete > list', () => {
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
   * Simple delete
   */
  test('delete', async () => {
    await prisma.commentRequiredList.delete({
      where: { id },
    })

    const count = await prisma.commentRequiredList.count({
      where: { id },
    })

    expect(count).toBe(0)
  })
})
