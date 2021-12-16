import { PrismaClient, Prisma } from '@prisma/client'

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const prisma = new PrismaClient()

  await prisma.user.findFirst({
    where: {
      info: {
        gt: 4,
      },
    },
  })

  await prisma.user.findFirst({
    where: {
      info: {
        path: ['any'],
        gt: 4,
      },
    },
  })
}

main().catch((e) => {
  console.error(e)
})
