import { getTestClient } from '../../../../../../utils/getTestClient'

let PrismaClient, prisma

const id = '2bbbbbbbbbbbbbbbbbbbbbbb'

/**
 * Test upsert create operations on optional composite fields
 */
describe('upsert > optional > create', () => {
  beforeAll(async () => {
    PrismaClient = await getTestClient('../../')
    prisma = new PrismaClient()
  })

  beforeEach(async () => {
    await prisma.commentOptionalProp.deleteMany({ where: { id } })
  })

  afterEach(async () => {
    await prisma.$disconnect()
  })

  /**
   * Simple set
   */
  test('set', async () => {
    const comment = await prisma.commentOptionalProp.upsert({
      where: { id },
      update: {},
      create: {
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
        id: 2bbbbbbbbbbbbbbbbbbbbbbb,
      }
    `)
  })

  /**
   * Set shorthand
   */
  test('set shorthand', async () => {
    const comment = await prisma.commentOptionalProp.upsert({
      where: { id },
      update: {},
      create: {
        id,
        country: 'France',
        content: {
          text: 'Hello World',
          upvotes: {
            vote: true,
            userId: '10',
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
        country: France,
        id: 2bbbbbbbbbbbbbbbbbbbbbbb,
      }
    `)
  })

  /**
   * Set null
   */
  test('set null', async () => {
    const comment = await prisma.commentOptionalProp.upsert({
      where: { id },
      update: {},
      create: {
        id,
        country: 'France',
        content: {
          set: null,
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(`
      Object {
        content: null,
        country: France,
        id: 2bbbbbbbbbbbbbbbbbbbbbbb,
      }
    `)
  })

  /**
   * Set null shorthand
   */
  test('set null shorthand', async () => {
    const comment = await prisma.commentOptionalProp.upsert({
      where: { id },
      update: {},
      create: {
        id,
        country: 'France',
        content: null,
      },
    })

    expect(comment).toMatchInlineSnapshot(`
      Object {
        content: null,
        country: France,
        id: 2bbbbbbbbbbbbbbbbbbbbbbb,
      }
    `)
  })

  /**
   * Set nested list
   */
  test('set nested list', async () => {
    const comment = await prisma.commentOptionalProp.upsert({
      where: { id },
      update: {},
      create: {
        id,
        country: 'France',
        content: {
          set: {
            text: 'Hello World',
            upvotes: [
              { userId: '10', vote: true },
              { userId: '11', vote: true },
            ],
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
            Object {
              userId: 11,
              vote: true,
            },
          ],
        },
        country: France,
        id: 2bbbbbbbbbbbbbbbbbbbbbbb,
      }
    `)
  })
})
