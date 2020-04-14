prisma.users
  .findOne({
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
  .findOne({
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
