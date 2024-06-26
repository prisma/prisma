import { PrismaClient } from '@prisma/client'

async function main() {
  const client = new PrismaClient()
  await client.test.count()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
