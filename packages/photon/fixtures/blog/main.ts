import { PrismaClient } from './@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    first: 1,
    include: {
      muser: true,
    },
  })

  console.log(users)

  process.exit()
  // prisma.disconnect()
}

main().catch(e => {
  console.error(e)
})
