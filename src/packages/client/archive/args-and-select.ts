prisma.users
  .findUnique({
    select: {
      posts: {
        select: {
          '*': false,
          id: true,
        },
        where: {
          createdAt: { gt: new Date() },
        },
      },
    },
    where: { age: { gt: 5 } },
  })
  .posts()
  .title()

prisma.users
  .findUnique({
    where: { age: { gt: 5 } },
  })
  .select({
    posts: {
      '*': false,
      id: true,
    },
  })
  .posts()
  .title()
