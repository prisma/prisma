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

  test('repeated calls to then', async () => {
    const createPromise = prisma.user.create({
      data: {
        email: 'email@email.em',
      },
    })

    const createResult1 = await createPromise.then()
    const createResult2 = await createPromise.then()

    expect(createResult1).toStrictEqual(createResult2)
  })

  beforeAll(async () => {
    const PrismaClient = await getTestClient()
    prisma = new PrismaClient()
  })

  beforeEach(async () => {
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })
})
