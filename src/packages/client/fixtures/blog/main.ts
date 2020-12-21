import { PrismaClient } from './@prisma/client'

const prisma = new PrismaClient({
  log: [
    {
      emit: 'stdout',
      level: 'query',
    },
  ],
})

async function main() {
  // prisma.$on('query', (q) => {
  //   console.log({ q })
  // })

  // const res = await prisma.user.groupBy({
  //   by: ['age', 'email'],
  //   avg: {
  //     age: true,
  //   },

  //   // count: {
  //   //   _all: true,
  //   // },
  // })

  // res.count._all

  // const rawQuery = prisma.$queryRaw`SELECT * FROM "public"."User"`
  // console.log(rawQuery)
  const updateUsers = prisma.user.updateMany({
    where: {
      name: 'A',
    },
    data: {
      name: 'B',
    },
  })

  const res = await prisma.$transaction([
    // rawQuery,
    updateUsers,
    prisma.$queryRaw`SELECT * FROM "public"."User"`,
    prisma.$queryRaw`SELECT * FROM "public"."Post"`,
    // prisma.user.findFirst(),
    // prisma.post.findFirst(),
  ])

  console.log(res)

  prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
})
