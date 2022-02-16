import { PrismaClient } from '@prisma/client'

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'file:dev.db',
      },
    },
  })

  await prisma.user.findMany({
    distinct: ['id', 'email', 'age', 'followerCount', 'name'],
  })
}

main().catch((e) => {
  console.error(e)
})
