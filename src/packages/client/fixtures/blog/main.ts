import { PrismaClient } from './@prisma/client'

const prisma = new PrismaClient({
  rejectNotFound: undefined
})

async function main() {
  const res = await prisma.user.findFirst({ 
    where: { 
      id: 'asdaf'
    },
    rejectNotFound: true
  })
  // console.log(res);
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
  prisma.$disconnect()
})
