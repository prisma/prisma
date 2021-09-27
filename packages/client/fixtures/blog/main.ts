import { PrismaClient } from './@prisma/client'

const prisma = new PrismaClient({
  rejectOnNotFound: {},
})

async function main() {
  const aggregate = await prisma.user.aggregate({
    count: true,
    sum: {
      age: true,
    },
  })
  const findMany = await prisma.user.findMany({
    select: {
      _count: true,
    },
  })
  findMany[0]._count
  aggregate.count
  aggregate.sum
  const groupBy = await prisma.user.groupBy({
    by: ['email'],
    _count: true,
  })
  const count = await prisma.user.count()

  console.log({
    //@ts-ignore
    engineType: prisma._clientEngineType,
    aggregate,
    groupBy,
    count,
    findMany,
  })
}

main().finally(async () => {
  await prisma.$disconnect()
})
