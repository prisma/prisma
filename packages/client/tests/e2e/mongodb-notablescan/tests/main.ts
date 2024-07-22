import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ errorFormat: 'minimal', log: ['query'] })

afterAll(async () => {
  await prisma.$disconnect()
})

test('filters on fields with indexes', async () => {
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
  const userId = subset[0].id

  // Queries below must use an index on `_id`, which is created by
  // default for all MongoDB collections.
  await prisma.user.findMany({ where: { id: userId } })
  await prisma.user.findMany({ where: { id: { in: [userId] } } })
  await prisma.user.findMany({ where: { id: { in: subset.map((user) => user.id) } } })
  // this will trigger the `update` case, which was a problem in the past: https://github.com/prisma/prisma/issues/12793
  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, username: 'username1' },
    update: { username: 'username1' },
  })

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
})
