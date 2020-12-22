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
  const res = await Promise.all([
    prisma.$transaction([
      prisma.$queryRaw`SELECT * FROM "public"."User"`,
      prisma.user.findFirst(),
      prisma.user.findFirst(),
    ]),
    // prisma.$queryRaw`SELECT * FROM "public"."Post"`,
    // ]),
    // prisma.$transaction([prisma.user.findFirst(), prisma.post.findFirst()]),
  ])

  console.log(res)

  prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
})
