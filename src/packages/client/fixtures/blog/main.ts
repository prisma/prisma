process.env.DEBUG = 'prisma-client'

import { PrismaClient } from './@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const res = await prisma.user.groupBy({
    by: ['age', 'email'],
    avg: {
      age: true,
    },
    // count: {
    //   _all: true,
    // },
  })

  // res.count._all

  console.log(res)

  prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
})
