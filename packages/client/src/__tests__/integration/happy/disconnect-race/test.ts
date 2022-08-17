import { generateTestClient } from '../../../../utils/getTestClient'

test('disconnect-race', async () => {
  await generateTestClient()
  const PrismaClient = require('./node_modules/@prisma/client').PrismaClient
  const prisma = new PrismaClient()

  await prisma.user.findMany()
  prisma.$disconnect()
  const a = await prisma.user.findMany()
  await prisma.$disconnect()
  expect(a).toMatchInlineSnapshot(`Array []`)
})
