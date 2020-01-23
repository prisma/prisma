import { PrismaClient } from './@prisma/client'

async function main() {
  const prisma = new PrismaClient({
    // log: ['query', 'info', 'warn'],
    debug: true,
  })

  // const user = await (prisma.user as any).findOne({})
  const users = await prisma.user.findMany({})

  console.log(users)
  prisma.disconnect()
}

main().catch(e => {
  console.error(e)
})
