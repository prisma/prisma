import { getTestClient } from '../../../../../utils/getTestClient'
import { commentOptionalPropDataA } from '../__helpers__/build-data/commentOptionalPropDataA'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

let PrismaClient, prisma

const id = '7aaaaaaaaaaaaaaaaaaaaaaa'

/**
 * Test findFirst operations on optional composite fields
 */
describeIf(!process.env.TEST_SKIP_MONGODB)('findFirst > optional', () => {
  beforeAll(async () => {
    PrismaClient = await getTestClient('../')
    prisma = new PrismaClient()
  })

  beforeEach(async () => {
    await prisma.commentOptionalProp.deleteMany({ where: { id } })
    await prisma.commentOptionalProp.create({ data: commentOptionalPropDataA(id) })
  })

  afterEach(async () => {
    await prisma.$disconnect()
  })

  /**
   * Simple find
   */
  test('simple', async () => {
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
        country: null,
        id: 7aaaaaaaaaaaaaaaaaaaaaaa,
      }
    `)
  })

  /**
   * Select
   */
  test('select', async () => {
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

  /**
   * Order by
   */
  test('orderBy', async () => {
    const comment = await prisma.commentOptionalProp.findFirst({
      where: { id },
      orderBy: {
        content: {
          upvotes: {
            _count: 'desc',
          },
        },
      },
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
        country: null,
        id: 7aaaaaaaaaaaaaaaaaaaaaaa,
      }
    `)
  })

  /**
   * Filter isSet
   */
  test('filter isSet', async () => {
    const comment = await prisma.commentOptionalProp.findFirst({
      where: { id, country: { isSet: true } },
    })

    expect(comment).toMatchInlineSnapshot(`null`)
  })
})
