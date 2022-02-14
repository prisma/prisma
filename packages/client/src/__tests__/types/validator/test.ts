import { PrismaClient, Prisma } from '@prisma/client'

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const prisma = new PrismaClient()

  const select = Prisma.validator<Prisma.UserSelect>()({
    id: true,
  })

  const data = await prisma.user.findFirst({ select })

  data?.id
}

main().catch((e) => {
  console.error(e)
})
