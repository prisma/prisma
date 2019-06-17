const { prisma } = require('../src/generated/prisma-client')

async function main() {
  await prisma.createUser({
    email: 'alice@prisma.io',
    name: 'Alice',
    password: '$2b$10$dqyYw5XovLjpmkYNiRDEWuwKaRAvLaG45fnXE5b3KTccKZcRPka2m', // "secret42"
    posts: {
      create: {
        title: 'Join us for Prisma Day 2019 in Berlin',
        content: 'https://www.prisma.io/day/',
        published: true,
      },
    },
  })
  await prisma.createUser({
    email: 'bob@prisma.io',
    name: 'Bob',
    password: '$2b$10$o6KioO.taArzboM44Ig85O3ZFZYZpR3XD7mI8T29eP4znU/.xyJbW', // "secret43"
    posts: {
      create: [
        {
          title: 'Subscribe to GraphQL Weekly for community news',
          content: 'https://graphqlweekly.com/',
          published: true,
        },
        {
          title: 'Follow Prisma on Twitter',
          content: 'https://twitter.com/prisma',
        },
      ],
    },
  })
}

main()
