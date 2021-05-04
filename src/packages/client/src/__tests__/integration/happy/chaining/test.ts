import { getTestClient } from '../../../../utils/getTestClient'

test('chaining', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()

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

  await prisma.$disconnect()

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
