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
  const res = await prisma.user.count({
    select: {
      $all: true,
      name: true,
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

  console.log(res)

  prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
})
