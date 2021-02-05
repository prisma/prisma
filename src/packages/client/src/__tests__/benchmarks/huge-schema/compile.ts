import { PrismaClient } from '@prisma/client'
const client = new PrismaClient()

async function main() {
  const a = await client.model1.findMany()
}
main().catch((err) => console.log(err))
