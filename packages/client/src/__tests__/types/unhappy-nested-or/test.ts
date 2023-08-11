import { PrismaClient, PrismaClientKnownRequestError } from '@prisma/client'

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const prisma = new PrismaClient()

  await prisma.user.findMany({
    where: {
      OR: [
        {
          asd: true,
        },
      ],
    },
  })
}

main().catch((e) => {
  console.error(e)
})
