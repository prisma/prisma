import { PrismaClient } from './@prisma/client'

const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
  ],
  rejectOnEmpty: {
    "House": true,
  }
})

async function main() {
  prisma.$on('query', (q) => {
    console.log({ q })
  })
  const res = await prisma.user.findUnique({ 
    where: { 
      id: 'asdaf'
    },
  })
  console.log(res);
  // const res = await prisma.user.findUnique({
  //   where: {
  //     email: 'prisma@prisma.de'
  //   },
  //   rejectOnEmpty: true
  // })

  // console.log(res)

  prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
})
