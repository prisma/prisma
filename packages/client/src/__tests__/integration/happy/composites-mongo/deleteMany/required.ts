import { getTestClient } from '../../../../../utils/getTestClient'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

let PrismaClient, prisma

const id = '1aaaaaaaaaaaaaaaaaaaaaaa'

/**
 * Test deleteMany operations on required composite fields
 */
describeIf(!process.env.TEST_SKIP_MONGODB)('deleteMany > required', () => {
  beforeAll(async () => {
    PrismaClient = await getTestClient('../')
    prisma = new PrismaClient()
  })

  beforeEach(async () => {
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
  })

  afterEach(async () => {
    await prisma.$disconnect()
  })

  /**
   * Simple delete
   */
  test('delete', async () => {
    await prisma.commentRequiredProp.deleteMany({
      where: { id },
    })

    const count = await prisma.commentRequiredProp.count({
      where: { id },
    })

    expect(count).toBe(0)
  })
})
