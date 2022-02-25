import { getTestClient } from '../../../../../utils/getTestClient'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

let PrismaClient, prisma

const id = '6ccccccccccccccccccccccc'

/**
 * Test aggregate operations on list composite fields
 */
describeIf(!process.env.TEST_SKIP_MONGODB)('aggregate > list', () => {
  beforeAll(async () => {
    PrismaClient = await getTestClient('../')
    prisma = new PrismaClient()
  })

  beforeEach(async () => {
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
  })

  afterEach(async () => {
    await prisma.$disconnect()
  })

  /**
   * Simple aggregate
   */
  test('simple', async () => {
    const comment = await prisma.commentRequiredList.aggregate({
      where: { id },
      orderBy: {
        contents: {
          _count: 'asc',
        },
      },
      _count: true,
    })

    expect(comment).toMatchInlineSnapshot(`
      Object {
        _count: 1,
      }
    `)
  })
})
