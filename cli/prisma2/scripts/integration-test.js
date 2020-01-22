const { PrismaClient } = require('../tmp')

async function main() {
  const prisma = new PrismaClient()
  const result = await prisma.teams.findMany()
  console.log(result)
  prisma.disconnect()
}

main()
