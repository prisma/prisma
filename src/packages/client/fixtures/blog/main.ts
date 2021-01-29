import { PrismaClient } from './@prisma/client'

const prisma = new PrismaClient({
  rejectOnNotFound: {},
  log: [
    {
      emit: 'event',
      level: 'query',
    },
  ],
})

async function main() {
  prisma.$on('query', () => {})
  const res = await prisma.user.createMany({
    data:[
    {
      email: 'test@1.com'
    },
    {
      email: 'test@2.com'
    }
  ]
  })
  console.log(res.count);
  prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
})
