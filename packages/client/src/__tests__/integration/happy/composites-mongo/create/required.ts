import { getTestClient } from '../../../../../utils/getTestClient'

let PrismaClient, prisma

const id = 'aaaaaaaaaaaaaaaaaaaaaaaa'

describe('create > required', () => {
  beforeAll(async () => {
    PrismaClient = await getTestClient('..')
  })

  beforeEach(async () => {
    prisma = new PrismaClient()
    await prisma.commentRequiredProp.deleteMany()
  })

  afterEach(async () => {
    await prisma.$disconnect()
  })

  test('set', async () => {
    const comment = await prisma.commentRequiredProp.create({
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
        id: aaaaaaaaaaaaaaaaaaaaaaaa,
      }
    `)
  })

  test('set shorthand', async () => {
    const comment = await prisma.commentRequiredProp.create({
      data: {
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
        id: aaaaaaaaaaaaaaaaaaaaaaaa,
      }
    `)
  })

  test('set nested', async () => {
    const comment = await prisma.commentRequiredProp.create({
      data: {
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
        id: aaaaaaaaaaaaaaaaaaaaaaaa,
      }
    `)
  })

  // test('set', async () => {})
  // test('set', async () => {})
  // test('set', async () => {})
  // test('set', async () => {})
  // test('set', async () => {})
  // test('set', async () => {})
  // test('set', async () => {})
})
