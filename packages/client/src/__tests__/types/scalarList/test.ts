import { PrismaClient } from '@prisma/client'

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const prisma = new PrismaClient()
  let result = await prisma.forest.findMany({
    where: {
      trees: {
        isEmpty: false,
      },
    },
  })

  result = await prisma.forest.findMany({
    where: {
      trees: {
        has: 'Oak',
      },
    },
  })

  result = await prisma.forest.findMany({
    where: {
      trees: {
        hasEvery: ['Oak', 'Pine'],
      },
    },
  })

  result = await prisma.forest.findMany({
    where: {
      trees: {
        hasSome: ['Ash'],
      },
    },
  })

  result = await prisma.forest.findMany({
    where: {
      randomInts: {
        isEmpty: false,
      },
    },
  })

  result = await prisma.forest.findMany({
    where: {
      randomInts: {
        hasSome: [1, 2, 5],
      },
    },
  })

  result = await prisma.forest.findMany({
    where: {
      randomInts: {
        hasEvery: [1, 2, 3, 5],
      },
    },
  })

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
})
