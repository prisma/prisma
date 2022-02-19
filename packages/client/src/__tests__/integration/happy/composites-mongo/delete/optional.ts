import { getTestClient } from '../../../../../utils/getTestClient'

let PrismaClient, prisma

const id = '5aaaaaaaaaaaaaaaaaaaaaaa'

/**
 * Test delete operations on optional composite fields
 */
describe('delete > optional', () => {
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
   * Simple delete
   */
  test('delete', async () => {
    await prisma.commentOptionalProp.delete({
      where: { id },
    })

    const count = await prisma.commentOptionalProp.count({
      where: { id },
    })

    expect(count).toBe(0)
  })
})
