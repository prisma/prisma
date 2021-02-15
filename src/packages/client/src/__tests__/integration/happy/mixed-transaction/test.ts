import { getTestClient } from '../../../../utils/getTestClient'

test('mixed transaction', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()

  await prisma.user.deleteMany()

  try {
    // Test connecting and disconnecting all the time
    const result = await prisma.$transaction([
      prisma.user.create({
        data: {
          email: 'test@hey.com',
        },
      }),
      prisma.user.create({
        data: {
          email: undefined,
        },
      }),
    ])
  } catch (e) {
    //
    // console.error(e)
  }

  await new Promise<void>((r) => r())

  let users = await prisma.user.findMany()
  expect(users).toMatchInlineSnapshot(`Array []`)

  await new Promise<void>((r) => r())

  users = await prisma.user.findMany()
  expect(users).toMatchInlineSnapshot(`Array []`)

  prisma.$disconnect()
})
