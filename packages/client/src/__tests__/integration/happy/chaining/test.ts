import { getTestClient } from '../../../../utils/getTestClient'

let prisma
describe('chaining', () => {
  test('lower-cased relations', async () => {
    const a: any[] = []
    a.push(
      await prisma.user
        .findUnique({
          where: {
            email: 'a@a.de',
          },
        })
        .property(),
    )

    a.push(
      await prisma.user
        .findUnique({
          where: {
            email: 'a@a.de',
          },
        })
        .property()
        .house(),
    )

    a.push(
      await prisma.user
        .findUnique({
          where: {
            email: 'a@a.de',
          },
        })
        .property()
        .house()
        .like(),
    )

    a.push(
      await prisma.user
        .findUnique({
          where: {
            email: 'a@a.de',
          },
        })
        .property()
        .house()
        .like()
        .post(),
    )

    a.push(
      await prisma.user
        .findUnique({
          where: {
            email: 'a@a.de',
          },
        })
        .property()
        .house()
        .like()
        .post()
        .author(),
    )

    a.push(
      await prisma.user
        .findUnique({
          where: {
            email: 'a@a.de',
          },
        })
        .property()
        .house()
        .like()
        .post()
        .author()
        .property(),
    )

    expect(a).toMatchInlineSnapshot(`
      Array [
        null,
        null,
        null,
        null,
        null,
        null,
      ]
    `)
  })

  test('upper-cased relations', async () => {
    const a: any[] = []
    a.push(
      await prisma.user
        .findUnique({
          where: {
            email: 'a@a.de',
          },
        })
        .Banking(),
    )

    a.push(
      await prisma.user
        .findUnique({
          where: {
            email: 'a@a.de',
          },
        })
        .Banking()
        .user(),
    )

    expect(a).toMatchInlineSnapshot(`
      Array [
        null,
        null,
      ]
    `)
  })

  test('findFirst', async () => {
    const posts = await prisma.user
      .findFirst({
        where: {
          email: 'email@email.io',
        },
      })
      .posts()

    expect(posts).toMatchInlineSnapshot(`Array []`)
  })

  test('create', async () => {
    const posts = await prisma.user
      .create({
        data: {
          email: 'email2@email.io',
        },
      })
      .posts()

    expect(posts).toMatchInlineSnapshot(`Array []`)
  })

  test('update', async () => {
    const posts = await prisma.user
      .update({
        where: {
          email: 'email@email.io',
        },
        data: {},
      })
      .posts()

    expect(posts).toMatchInlineSnapshot(`Array []`)
  })

  test('upsert', async () => {
    const posts = await prisma.user
      .upsert({
        where: {
          email: 'email@email.io',
        },
        create: {
          email: 'email@email.io',
        },
        update: {},
      })
      .posts()

    expect(posts).toMatchInlineSnapshot(`Array []`)
  })

  test('delete', async () => {
    const posts = await prisma.user
      .delete({
        where: {
          email: 'email@email.io',
        },
      })
      .posts()

    expect(posts).toMatchInlineSnapshot(`Array []`)
  })

  beforeAll(async () => {
    const PrismaClient = await getTestClient()
    prisma = new PrismaClient()
  })

  beforeEach(async () => {
    await prisma.user.deleteMany()
    const user = await prisma.user.create({
      data: {
        email: 'email@email.io',
      },
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })
})
