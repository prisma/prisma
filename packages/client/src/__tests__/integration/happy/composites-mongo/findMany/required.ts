import { getTestClient } from '../../../../../utils/getTestClient'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

let PrismaClient, prisma

const id = '3aaaaaaaaaaaaaaaaaaaaaaa'

/**
 * Test findMany operations on required composite fields
 */
describeIf(!process.env.TEST_SKIP_MONGODB)('findMany > required', () => {
  beforeAll(async () => {
    PrismaClient = await getTestClient('../')
    prisma = new PrismaClient()
  })

  beforeEach(async () => {
    await prisma.commentRequiredProp.deleteMany({ where: { id } })
    await prisma.commentRequiredProp.create({
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
    const comment = await prisma.commentRequiredProp.findMany({
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
          id: 3aaaaaaaaaaaaaaaaaaaaaaa,
        },
      ]
    `)
  })

  /**
   * Find select
   */
  test('find select', async () => {
    const comment = await prisma.commentRequiredProp.findMany({
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
