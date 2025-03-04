import { PrismaClient } from '@prisma/client'

test('can make a query', async () => {
  const prisma = new PrismaClient()
  const data = await prisma.user.findMany()

  expect(data).toEqual([])
})
