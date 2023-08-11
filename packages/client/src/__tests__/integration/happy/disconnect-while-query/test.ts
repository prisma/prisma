import { getTestClient } from '../../../../utils/getTestClient'

test('disconnect-while-query', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()

  await prisma.user.findMany()
  const a = prisma.user.findMany()

  prisma.$disconnect()
  await a // re-wakes the engine
  await prisma.$disconnect()

  expect(await a).toMatchInlineSnapshot(`[]`)

  await prisma.$disconnect()
})
