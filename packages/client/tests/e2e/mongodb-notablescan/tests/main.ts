import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ errorFormat: 'minimal', log: ['query'] })

afterAll(async () => {
  await prisma.$disconnect()
})

test('testy test', async () => {
  const users = []
  for (let i = 0; i < 10_000; i++) {
    users.push({ username: 'username' })
  }
  await prisma.user.createMany({ data: users })
  const userWithPost = await prisma.user.create({
    data: {
      username: 'username',
      post: {
        create: {
          content: 'content',
        },
      },
    },
  })

  // This query does not use any indexes, but `notablescan` option permits
  // this kind of query because it does not contain any filters.
  const subset = await prisma.user.findMany({ take: 10 })

  // Three queries below must use an index on `_id`, which is created by
  // default for all MongoDB collections.
  await prisma.user.findMany({ where: { id: subset[0].id } })
  await prisma.user.findMany({ where: { id: { in: [subset[0].id] } } })
  await prisma.user.findMany({ where: { id: { in: subset.map((user) => user.id) } } })

  // This query must use an index on `authorId` field we defined in Prisma Schema when
  // fetching the `Post` relation.
  await prisma.user.findFirst({
    where: {
      id: userWithPost.id,
    },
    include: {
      post: true,
    },
  })

  console.log('Everything is fine!')
})
