import { getTestClient } from '../../../../../utils/getTestClient'

let PrismaClient, prisma

const id = '6bbbbbbbbbbbbbbbbbbbbbbb'

/**
 * Test delete operations on list composite fields
 */
describe('delete > list', () => {
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
