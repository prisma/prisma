import pRetry from 'p-retry'

import { getTestClient } from '../../../../../utils/getTestClient'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

let PrismaClient, prisma

const id = '6aaaaaaaaaaaaaaaaaaaaaaa'

/**
 * Test deleteMany operations on optional composite fields
 */
describeIf(!process.env.TEST_SKIP_MONGODB)('deleteMany > optional', () => {
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
   * Simple delete
   */
  test('delete', async () => {
    await prisma.commentOptionalProp.deleteMany({
      where: { id },
    })

    const count = await prisma.commentOptionalProp.count({
      where: { id },
    })

    expect(count).toBe(0)
  })
})
