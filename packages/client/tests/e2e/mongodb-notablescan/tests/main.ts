import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ errorFormat: 'minimal' })

afterAll(async () => {
  await prisma.$disconnect()
})

test('testy test', async () => {
  const users = []
  for (let i = 0; i < 10_000; i++) {
    users.push({ username: 'username' })
  }
  await prisma.user.createMany({ data: users })

  // This query does not use any indexes, but `notablescan` option permits
  // this kind of query because it does not contain any filters.
  const subset = await prisma.user.findMany({ take: 10 })

  // All queries below must use indexes or fail.
  await prisma.user.findMany({ where: { id: subset[0].id } })
  await prisma.user.findMany({ where: { id: { in: subset.map((user) => user.id) } } })

  console.log('Everything is fine!')
})
