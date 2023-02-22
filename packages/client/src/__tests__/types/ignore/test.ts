import { PrismaClient } from '@prisma/client'

// just make sure the client types compile
async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'file:dev.db',
      },
    },
  })
}

main().catch((e) => {
  console.error(e)
})
