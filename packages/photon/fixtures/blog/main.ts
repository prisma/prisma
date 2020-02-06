import { PrismaClient } from './@prisma/client'

async function main() {
  const prisma = new PrismaClient({
    // log: ['query', 'info', 'warn'],
    // __internal: {debug: true}
  })

  const rawQuery = await prisma.raw`SELECT 1`
  console.log({rawQuery})

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
