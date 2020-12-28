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

  const x = await prisma.user.groupBy({
    by: ['name'],
    where: {
      age: {
        gt: -1,
      },
    },
    orderBy: [
      {
        name: 'desc',
      },
    ],
    skip: 0,
    take: 10000,
    avg: {
      age: true,
    },
    count: {
      age: true,
      _all: true,
    },
    max: {
      age: true,
    },
    min: {
      age: true,
    },
    sum: {
      age: true,
    },
  })

  const { avg, count, max, sum, min, name } = x

  avg.age
  count._all
  count.age
  max.age
  name
  sum.age
  min.age
}

main().catch((e) => {
  console.error(e)
})
