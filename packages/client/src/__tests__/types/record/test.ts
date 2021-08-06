import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()

  const data = await prisma.record.findFirst()

  console.log(data)
  await prisma.$disconnect()
}

main()
