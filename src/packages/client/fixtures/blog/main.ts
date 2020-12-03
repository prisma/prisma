process.env.DEBUG = 'prisma-client'
import { PrismaClient, FindFirstPostArgs, sql } from './@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const count = await prisma.user.count({
    // count: true,
  })
  console.log(count)

  prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
})
