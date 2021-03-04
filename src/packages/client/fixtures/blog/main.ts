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
  const users = await prisma.user.findMany()
  console.log(users);
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
})
