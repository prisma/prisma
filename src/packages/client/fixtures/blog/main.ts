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
  // const res = await prisma.user.count({
  //   select: {
  //     _all: true,
  //     name: true,
  //   },
  // })
  const res = await prisma.user.count({
    select: true,
    // skip: 3
  })

  console.log(res)

  prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
})
