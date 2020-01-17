import { PrismaClient } from './@prisma/client'

async function main() {
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn'],
  })

  const users = await prisma.users({
    orderBy: null,
  })

  console.log(users)
  prisma.disconnect()
}

main().catch(e => {
  console.error(e)
})
