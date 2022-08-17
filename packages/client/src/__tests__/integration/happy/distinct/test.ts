import { generateTestClient } from '../../../../utils/getTestClient'

test('distinct', async () => {
  await generateTestClient()
  const PrismaClient = require('./node_modules/@prisma/client').PrismaClient
  const prisma = new PrismaClient()

  let result = await prisma.user.findMany({
    distinct: ['id'], // distinct on id has no effect, as it's distinct anyway
  })

  expect(result.length).toBe(10)

  result = await prisma.user.findMany({
    distinct: ['name'],
  })

  expect(result.length).toBe(1)

  await prisma.$disconnect()
})
