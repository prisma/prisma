import { getTestClient } from '../../../../../utils/getTestClient'
import { commentRequiredListDataA } from '../__helpers___/build-data/commentRequiredListDataA'
import { commentRequiredListDataB } from '../__helpers___/build-data/commentRequiredListDataB'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

let PrismaClient, prisma

const id1 = '9bbbbbbbbbbbbbbbbbbbbbbb'
const id2 = '0ddddddddddddddddddddddd'

/**
 * Test findMany operations on list composite fields
 */
describeIf(!process.env.TEST_SKIP_MONGODB)('findMany > list', () => {
  beforeAll(async () => {
    PrismaClient = await getTestClient('../')
    prisma = new PrismaClient()
  })

  beforeEach(async () => {
    await prisma.commentRequiredList.deleteMany({ where: { OR: [{ id: id1 }, { id: id2 }] } })
    await prisma.commentRequiredList.createMany({
      data: [commentRequiredListDataA(id1), commentRequiredListDataB(id2)],
    })
  })

  afterEach(async () => {
    await prisma.$disconnect()
  })

  /**
   * Simple find
   */
  test('simple', async () => {
    const comment = await prisma.commentRequiredList.findMany({
      where: { id: id1 },
    })

    expect(comment).toMatchInlineSnapshot(`
      Array [
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
          id: 9bbbbbbbbbbbbbbbbbbbbbbb,
        },
      ]
    `)
  })

  /**
   * Select
   */
  test('select', async () => {
    const comment = await prisma.commentRequiredList.findMany({
      where: { id: id1 },
      select: {
        contents: {
          select: {
            text: true,
          },
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(`
      Array [
        Object {
          contents: Array [
            Object {
              text: Hello World,
            },
          ],
        },
      ]
    `)
  })

  /**
   * Order by
   */
  test('orderBy', async () => {
    const comment = await prisma.commentRequiredList.findMany({
      where: { OR: [{ id: id1 }, { id: id2 }] },
      orderBy: {
        contents: {
          _count: 'desc',
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(`
      Array [
        Object {
          contents: Array [
            Object {
              text: Goodbye World,
              upvotes: Array [
                Object {
                  userId: 11,
                  vote: false,
                },
              ],
            },
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
          id: 0ddddddddddddddddddddddd,
        },
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
          id: 9bbbbbbbbbbbbbbbbbbbbbbb,
        },
      ]
    `)
  })
})
