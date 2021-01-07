import { PrismaClient } from './@prisma/client'

const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
  ],
})

async function main() {
  const user = await prisma.user.groupBy({
    by: ['name'],
    where: {
      age: {
        gt: -1,
      },
    },
    // skip: 0,
    // take: 10000,
    avg: {
      age: true,
    },
    count: {
      // age: true,
      $all: true,
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
  // const res = await prisma.user.aggregate({
  //   // select: true,
  //   // skip: 3
  //   count: true,
  //   min: {
  //     email: true,
  //     // json: true,
  //   },
  // })

  console.log(user[0].count.$all)

  prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
})
