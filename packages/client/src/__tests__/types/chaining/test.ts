import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()

  await prisma.user.findFirst().posts()

  await prisma.user.findFirst().posts({
    where: {
      published: true,
    },
  })

  await prisma.post.findFirst().author()

  await prisma.post.findFirst().author({
    select: {
      email: true,
    },
  })
}

main().catch(console.error)
