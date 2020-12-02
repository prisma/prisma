import { PrismaClient, FindFirstPostArgs, sql } from './@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        {
          age: 123,
        },
      ],
    },
  })

  prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
})
