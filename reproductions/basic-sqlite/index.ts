import { PrismaClient } from '.prisma/client'

async function main() {
  const prisma = new PrismaClient()

  const email = `user.${Date.now()}@prisma.io`
  await prisma.user.create({
    data: {
      email: email,
    },
  })

  const users = await prisma.user.findMany()

  console.log(users)
}

void main().catch((e) => {
  console.log(e.message)
  process.exit(1)
})
