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

  const { avg, count, max, min, name, sum } = await prisma.user.groupBy({
    by: ['name'],
    where: {
      age: {
        gt: -1,
      },
    },
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
