import { PrismaClient } from '@prisma/client'

// tslint:disable

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'file:dev.db',
      },
    },
  })

  const { count, avg, max, min, sum } = await prisma.user.aggregate({
    cursor: {
      email: 'a@a.de',
    },
    orderBy: {
      age: 'asc',
    },
    skip: 12,
    take: 10,
    where: {
      age: { gt: 500 },
    },
    count: true,
    avg: {
      age: true,
      followerCount: true,
    },
    max: {
      age: true,
      followerCount: true,
    },
    min: {
      age: true,
      followerCount: true,
    },
    sum: {
      age: true,
      followerCount: true,
    },
  })

  const { age, followerCount } = max
}

main().catch((e) => {
  console.error(e)
})
