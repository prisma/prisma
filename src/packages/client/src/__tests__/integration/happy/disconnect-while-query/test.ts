import { getTestClient } from '../../../../utils/getTestClient'

test('disconnect-while-query', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()

  await prisma.user.findMany()
  const a = prisma.user.findMany()
  prisma.$disconnect()

  await a
  await prisma.$disconnect()

  expect(await a).toMatchInlineSnapshot(`Array []`)
})
