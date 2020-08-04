import { PrismaClient } from './@prisma/client'

const prisma = new PrismaClient({
  errorFormat: 'pretty',
} as any)

async function main() {
  const x = await prisma.user.findMany({
    orderBy: {
      email: 'desc',
      name: 'asc',
    },
  })
  console.log(x)
  prisma.disconnect()
}

main().catch((e) => {
  console.error(e)
})
