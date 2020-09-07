const { PrismaClient } = require('@prisma/client')
const assert = require('assert')

module.exports = async () => {
  const prisma = new PrismaClient()

  await prisma.user.findMany()
  const a = prisma.user.findMany()
  prisma.$disconnect()

  await a
  await prisma.$disconnect()

  return await a
}

if (require.main === module) {
  module.exports()
}
