import { getTestClient } from '../../../../../utils/getTestClient'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

let PrismaClient, prisma

const id = '9bbbbbbbbbbbbbbbbbbbbbbb'

/**
 * Test findMany operations on list composite fields
 */
describeIf(!process.env.TEST_SKIP_MONGODB)('findMany > list', () => {
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
  test('simple', async () => {
    const comment = await prisma.commentRequiredList.findMany({
      where: { id },
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
      orderBy: {
        contents: {
          _count: 'asc',
        },
      },
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
                Object {
                  userId: 11,
                  vote: true,
                },
              ],
            },
          ],
          country: France,
          id: 5bbbbbbbbbbbbbbbbbbbbbbb,
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
                Object {
                  userId: 11,
                  vote: true,
                },
              ],
            },
          ],
          country: France,
          id: 4bbbbbbbbbbbbbbbbbbbbbbb,
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
          id: 3ccccccccccccccccccccccc,
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
          id: 1ccccccccccccccccccccccc,
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
                Object {
                  userId: 11,
                  vote: true,
                },
              ],
            },
          ],
          country: France,
          id: 2ccccccccccccccccccccccc,
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
          id: 8bbbbbbbbbbbbbbbbbbbbbbb,
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
          id: 0ccccccccccccccccccccccc,
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
