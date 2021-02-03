//@ts-ignore
import { PrismaClient } from '@prisma/client'
const client = new PrismaClient()

async function main() {
  const a = await client.a.findMany()
  console.log(a)
}
main().catch((err) => console.log(err))
