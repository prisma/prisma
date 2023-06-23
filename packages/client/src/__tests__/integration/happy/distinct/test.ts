import { getTestClient } from '../../../../utils/getTestClient'

test('distinct', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()

  const resultId = await prisma.user.findMany({
    distinct: ['id'], // distinct on id has no effect, as it's distinct anyway
  })
  expect(resultId.length).toBe(10)

  const resultName = await prisma.user.findMany({
    distinct: ['name'],
  })
  expect(resultName.length).toBe(1)

  const resultIdShortcut = await prisma.user.findMany({
    distinct: 'id', // distinct on id has no effect, as it's distinct anyway
  })
  expect(resultIdShortcut.length).toBe(10)

  const resultNameShortcut = await prisma.user.findMany({
    distinct: 'name',
  })
  expect(resultNameShortcut.length).toBe(1)

  await prisma.$disconnect()
})
