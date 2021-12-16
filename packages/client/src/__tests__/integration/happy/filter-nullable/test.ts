import { getTestClient } from '../../../../utils/getTestClient'

test('filter-nullable', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()

  const result = await prisma.sale.findMany({
    where: {
      resale: null,
    },
  })

  expect(result).toEqual([
    { id: '1', resaleId: null },
    { id: '2', resaleId: null },
  ])

  await prisma.$disconnect()
})
