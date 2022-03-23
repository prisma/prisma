import { getTestClient } from '../../../../../utils/getTestClient'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

let PrismaClient, prisma

const id = '9ccccccccccccccccccccccc'

/**
 * Test count operations on required composite fields
 */
describeIf(!process.env.TEST_SKIP_MONGODB)('count > required', () => {
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
   * Simple count
   */
  test('count', async () => {
    const comment = await prisma.commentRequiredProp.count({
      where: { id },
      orderBy: {
        content: {
          upvotes: {
            _count: 'desc',
          },
        },
      },
      _count: true,
    })

    expect(comment).toMatchInlineSnapshot(`1`)
  })
})
