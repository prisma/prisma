import { getTestClient } from '../../../../../utils/getTestClient'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

let PrismaClient, prisma

const id = '4ccccccccccccccccccccccc'

/**
 * Test find operations on optional composite fields
 */
describeIf(!process.env.TEST_SKIP_MONGODB)('find > optional', () => {
  beforeAll(async () => {
    PrismaClient = await getTestClient('../')
    prisma = new PrismaClient()
  })

  beforeEach(async () => {
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
  })

  afterEach(async () => {
    await prisma.$disconnect()
  })

  /**
   * Simple aggregate
   */
  test('aggregate', async () => {
    const comment = await prisma.commentRequiredProp.aggregate({
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

    expect(comment).toMatchInlineSnapshot(`
      Object {
        _count: 0,
      }
    `)
  })
})
