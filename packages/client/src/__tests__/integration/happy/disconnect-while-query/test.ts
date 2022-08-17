import { generateTestClient } from '../../../../utils/getTestClient'

test('disconnect-while-query', async () => {
  await generateTestClient()
  const PrismaClient = require('./node_modules/@prisma/client').PrismaClient
  const prisma = new PrismaClient()

  await prisma.user.findMany()
  const a = prisma.user.findMany()

  prisma.$disconnect()
  await a // re-wakes the engine
  await prisma.$disconnect()

  expect(await a).toMatchInlineSnapshot(`Array []`)

  await prisma.$disconnect()
})
