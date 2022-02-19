import { getTestClient } from '../../../../../utils/getTestClient'

let PrismaClient, prisma

const id = '8bbbbbbbbbbbbbbbbbbbbbbb'

/**
 * Test find operations on list composite fields
 */
describe('find > list', () => {
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
   * Simple find
   */
  test('find', async () => {
    const comment = await prisma.commentRequiredList.findFirst({
      where: { id },
    })

    expect(comment).toMatchInlineSnapshot(`
      Object {
        contents: Array [
          Object {
            text: Hello World,
            upvotes: Array [
              Object {
                userId: 10,
                vote: true,
              },
            ],
          },
        ],
        country: France,
        id: 8bbbbbbbbbbbbbbbbbbbbbbb,
      }
    `)
  })

  /**
   * Find select
   */
  test('find select', async () => {
    const comment = await prisma.commentRequiredList.findFirst({
      where: { id },
      select: {
        contents: {
          select: {
            text: true,
          },
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(`
      Object {
        contents: Array [
          Object {
            text: Hello World,
          },
        ],
      }
    `)
  })
})
