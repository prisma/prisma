import { generateTestClient } from '../../../../utils/getTestClient'

test('multi-connect', async () => {
  await generateTestClient()
  const PrismaClient = require('./node_modules/@prisma/client').PrismaClient
  const prisma = new PrismaClient()

  await prisma.user.findMany()
  const a = prisma.user.findMany()
  prisma.$disconnect()
  await prisma.$disconnect()
  prisma.$disconnect()
  await prisma.$connect()
  prisma.$connect()

  await a
  const result = await prisma.user.findMany()

  await prisma.$disconnect()
  expect(result).toMatchInlineSnapshot(`Array []`)
})
