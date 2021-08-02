import { getTestClient } from '../../../../utils/getTestClient'

test('distinct', async () => {
  const PrismaClient = await getTestClient()
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
