import { getTestClient } from '../../../../../utils/getTestClient'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

let PrismaClient, prisma

const id = '7aaaaaaaaaaaaaaaaaaaaaaa'

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
   * Simple find
   */
  test('find', async () => {
    const comment = await prisma.commentOptionalProp.findFirst({
      where: { id },
    })

    expect(comment).toMatchInlineSnapshot(`
      Object {
        content: Object {
          text: Hello World,
          upvotes: Array [
            Object {
              userId: 10,
              vote: true,
            },
          ],
        },
        country: France,
        id: 7aaaaaaaaaaaaaaaaaaaaaaa,
      }
    `)
  })

  /**
   * Find select
   */
  test('find select', async () => {
    const comment = await prisma.commentOptionalProp.findFirst({
      where: { id },
      select: {
        content: {
          select: {
            text: true,
          },
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(`
      Object {
        content: Object {
          text: Hello World,
        },
      }
    `)
  })
})
