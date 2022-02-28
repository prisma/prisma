import { getTestClient } from '../../../../../utils/getTestClient'
import { commentOptionalPropDataA } from '../utils/build-data/commentOptionalPropDataA'
import { commentOptionalPropDataB } from '../utils/build-data/commentOptionalPropDataB'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

let PrismaClient, prisma

const id1 = '8aaaaaaaaaaaaaaaaaaaaaaa'
const id2 = '1ddddddddddddddddddddddd'

/**
 * Test findMany operations on optional composite fields
 */
describeIf(!process.env.TEST_SKIP_MONGODB)('findMany > optional', () => {
  beforeAll(async () => {
    PrismaClient = await getTestClient('../')
    prisma = new PrismaClient()
  })

  beforeEach(async () => {
    await prisma.commentOptionalProp.deleteMany({ where: { OR: [{ id: id1 }, { id: id2 }] } })
    await prisma.commentOptionalProp.createMany({
      data: [commentOptionalPropDataA(id1), commentOptionalPropDataB(id2)],
    })
  })

  afterEach(async () => {
    await prisma.$disconnect()
  })

  /**
   * Simple find
   */
  test('simple', async () => {
    const comment = await prisma.commentOptionalProp.findMany({
      where: { id: id1 },
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
   * Select
   */
  test('select', async () => {
    const comment = await prisma.commentOptionalProp.findMany({
      where: { id: id1 },
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

  /**
   * Order by
   */
  test('orderBy', async () => {
    const comment = await prisma.commentOptionalProp.findMany({
      where: { OR: [{ id: id1 }, { id: id2 }] },
      orderBy: {
        content: {
          upvotes: {
            _count: 'desc',
          },
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(`
      Array [
        Object {
          content: Object {
            text: Goodbye World,
            upvotes: Array [
              Object {
                userId: 11,
                vote: false,
              },
              Object {
                userId: 12,
                vote: true,
              },
            ],
          },
          country: France,
          id: 1ddddddddddddddddddddddd,
        },
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
})
