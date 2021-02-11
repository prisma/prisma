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
  await prisma.$connect()
  let res = await prisma.$transaction([
    prisma.user.create({
      data: {
        age: 1000,
        email: 'a@a.de2',
        name: 'blub',
      },
    }),
  ])
  console.log(res)
  prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
})
