import { PrismaClient } from './@prisma/client'

async function main() {
  const prisma = new PrismaClient({
    // log: ['query', 'info', 'warn'],
    // debug: true,
  })

  const users = await prisma.user.findMany({
    where: {
      posts: null,
    },
  })

  console.log(users)
  prisma.disconnect()
}

main().catch(e => {
  console.error(e)
})
