import { getTestClient } from '../../../../utils/getTestClient'

test('findFirst with a result', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()
  const user = await prisma.user.findFirst()
  await prisma.$disconnect()
  expect(user).toMatchInlineSnapshot(`
    Object {
      email: a@a.de,
      id: 576eddf9-2434-421f-9a86-58bede16fd95,
      name: Alice,
    }
  `)
})

test('findFirst without a result', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()
  const user = await prisma.user.findFirst({
    where: {
      email: 'asdasd',
    },
  })
  await prisma.$disconnect()
  expect(user).toMatchInlineSnapshot(`null`)
})
