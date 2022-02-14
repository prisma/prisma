import { PrismaClient, user } from '@prisma/client'

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const prisma = new PrismaClient()

  const user: user | null = await prisma.user.findFirst()
}

main().catch((e) => {
  console.error(e)
})
