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
  prisma.$on('query', (q) => {
    console.log({ q })
  })

  const res = await prisma.user.groupBy({
    by: ['age', 'email'],
    avg: {
      age: true,
    },
  })

  console.log(res)

  prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
})
