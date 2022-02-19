import { getTestClient } from '../../../../../utils/getTestClient'

let PrismaClient, prisma

const id = '8aaaaaaaaaaaaaaaaaaaaaaa'

/**
 * Test findMany operations on optional composite fields
 */
describe('findMany > optional', () => {
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
    const comment = await prisma.commentOptionalProp.findMany({
      where: { id },
    })

    expect(comment).toMatchInlineSnapshot(`
      Array [
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
          id: 8aaaaaaaaaaaaaaaaaaaaaaa,
        },
      ]
    `)
  })

  /**
   * Find select
   */
  test('find select', async () => {
    const comment = await prisma.commentOptionalProp.findMany({
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
      Array [
        Object {
          content: Object {
            text: Hello World,
          },
        },
      ]
    `)
  })
})
