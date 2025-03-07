import { PrismaClient } from '.prisma/client'

async function main() {
  const prisma = new PrismaClient()

  await prisma.user.create({
    data: {
      name: 'jkomyno',
      id: 1,
    },
  })

  const users = await prisma.user.findMany()

  console.log(users)
}

void main().catch((e) => {
  console.log(e.message)
  process.exit(1)
})
