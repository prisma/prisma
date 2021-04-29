import { PrismaClient, Prisma } from './@prisma/client'

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
  const users = await prisma.user.aggregate({
    _avg: {
      age: true,
    },
  })

  // maybe I want to use the same selection set in a second query:
  const result2 = await prisma.user.findUnique({
    where: { id: 'x' },
  })

  console.log(users)
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
})
