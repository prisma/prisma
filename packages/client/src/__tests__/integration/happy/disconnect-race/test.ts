import { getTestClient } from '../../../../utils/getTestClient'

test('disconnect-race', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()

  await prisma.user.findMany()
  prisma.$disconnect()
  const a = await prisma.user.findMany()
  await prisma.$disconnect()
  expect(a).toMatchInlineSnapshot(`[]`)
})
