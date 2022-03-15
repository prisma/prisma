import { getTestClient } from '../../../../../utils/getTestClient'
import { commentRequiredPropDataA } from '../__helpers__/build-data/commentRequiredPropDataA'
import { commentRequiredPropDataB } from '../__helpers__/build-data/commentRequiredPropDataB'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

let PrismaClient, prisma

const id1 = '3aaaaaaaaaaaaaaaaaaaaaaa'
const id2 = '2ddddddddddddddddddddddd'

/**
 * Test findMany operations on required composite fields
 */
describeIf(!process.env.TEST_SKIP_MONGODB)('findMany > required', () => {
  beforeAll(async () => {
    PrismaClient = await getTestClient('../')
    prisma = new PrismaClient()
  })

  beforeEach(async () => {
    await prisma.commentRequiredProp.deleteMany({ where: { OR: [{ id: id1 }, { id: id2 }] } })
    await prisma.commentRequiredProp.createMany({
      data: [commentRequiredPropDataA(id1), commentRequiredPropDataB(id2)],
    })
  })

  afterEach(async () => {
    await prisma.$disconnect()
  })

  /**
   * Simple find
   */
  test('simple', async () => {
    const comment = await prisma.commentRequiredProp.findMany({
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
          id: 3aaaaaaaaaaaaaaaaaaaaaaa,
        },
      ]
    `)
  })

  /**
   * Select
   */
  test('select', async () => {
    const comment = await prisma.commentRequiredProp.findMany({
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
    const comment = await prisma.commentRequiredProp.findMany({
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
          id: 2ddddddddddddddddddddddd,
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
          id: 3aaaaaaaaaaaaaaaaaaaaaaa,
        },
      ]
    `)
  })

  /**
   * Filter equals
   */
  test('filter equals', async () => {
    const comment = await prisma.commentRequiredProp.findMany({
      where: {
        OR: [{ id: id1 }, { id: id2 }],
        content: commentRequiredPropDataA(id1).content.set,
      },
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
          id: 3aaaaaaaaaaaaaaaaaaaaaaa,
        },
      ]
    `)
  })

  /**
   * Filter equals shorthand
   */
  test('filter equals shorthand', async () => {
    const comment = await prisma.commentRequiredProp.findMany({
      where: {
        OR: [{ id: id1 }, { id: id2 }],
        content: commentRequiredPropDataA(id1).content.set,
      },
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
          id: 3aaaaaaaaaaaaaaaaaaaaaaa,
        },
      ]
    `)
  })

  /**
   * Filter is
   */
  test('filter is', async () => {
    const comment = await prisma.commentRequiredProp.findMany({
      where: {
        OR: [{ id: id1 }, { id: id2 }],
        content: { is: { OR: [{ text: 'Hello World' }, { text: 'Goodbye World' }] } },
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
          id: 2ddddddddddddddddddddddd,
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
          id: 3aaaaaaaaaaaaaaaaaaaaaaa,
        },
      ]
    `)
  })

  /**
   * Filter isNot
   */
  test('filter isNot', async () => {
    const comment = await prisma.commentRequiredProp.findMany({
      where: {
        OR: [{ id: id1 }, { id: id2 }],
        content: { isNot: { text: 'Goodbye World' } },
      },
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
          id: 3aaaaaaaaaaaaaaaaaaaaaaa,
        },
      ]
    `)
  })
})
