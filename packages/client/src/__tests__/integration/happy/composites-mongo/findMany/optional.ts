import pRetry from 'p-retry'

import { getTestClient } from '../../../../../utils/getTestClient'
import { commentOptionalPropDataA } from '../__helpers__/build-data/commentOptionalPropDataA'
import { commentOptionalPropDataB } from '../__helpers__/build-data/commentOptionalPropDataB'

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
    await pRetry(
      async () => {
        await prisma.commentOptionalProp.deleteMany({ where: { OR: [{ id: id1 }, { id: id2 }] } })
        await prisma.commentOptionalProp.createMany({
          data: [commentOptionalPropDataA(id1), commentOptionalPropDataB(id2)],
        })
      },
      { retries: 2 },
    )
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
          country: null,
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
          country: null,
          id: 8aaaaaaaaaaaaaaaaaaaaaaa,
        },
      ]
    `)
  })

  /**
   * Filter equals
   */
  test('filter equals', async () => {
    const comment = await prisma.commentOptionalProp.findMany({
      where: {
        OR: [{ id: id1 }, { id: id2 }],
        content: { equals: commentOptionalPropDataA(id1).content.set },
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
          country: null,
          id: 8aaaaaaaaaaaaaaaaaaaaaaa,
        },
      ]
    `)
  })

  /**
   * Filter equals shorthand
   */
  test('filter equals shorthand', async () => {
    const comment = await prisma.commentOptionalProp.findMany({
      where: {
        OR: [{ id: id1 }, { id: id2 }],
        content: commentOptionalPropDataA(id1).content.set,
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
          country: null,
          id: 8aaaaaaaaaaaaaaaaaaaaaaa,
        },
      ]
    `)
  })

  /**
   * Filter is
   */
  test('filter is', async () => {
    const comment = await prisma.commentOptionalProp.findMany({
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
          country: null,
          id: 8aaaaaaaaaaaaaaaaaaaaaaa,
        },
      ]
    `)
  })

  /**
   * Filter isNot
   */
  test('filter isNot', async () => {
    const comment = await prisma.commentOptionalProp.findMany({
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
          country: null,
          id: 8aaaaaaaaaaaaaaaaaaaaaaa,
        },
      ]
    `)
  })

  /**
   * Filter isSet
   */
  test('filter isSet', async () => {
    const comment = await prisma.commentOptionalProp.findFirst({
      where: {
        OR: [{ id: id1 }, { id: id2 }],
        country: { isSet: true },
      },
    })

    expect(comment).toMatchInlineSnapshot(`
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
      }
    `)
  })
})
