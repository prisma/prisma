import { PrismaClient } from './@prisma/client'

async function main() {
  const prisma = new PrismaClient({})

  const users = await prisma.users({
    orderBy: null,
  })

  console.log(users)
}

main().catch(e => {
  console.error(e)
})
