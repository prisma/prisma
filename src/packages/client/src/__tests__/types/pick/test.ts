import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()

  const data = await prisma.pick.findFirst({
    include: {
      author: true,
    },
  })

  data?.author.id

  console.log(data)
  prisma.$disconnect()
}

main()
