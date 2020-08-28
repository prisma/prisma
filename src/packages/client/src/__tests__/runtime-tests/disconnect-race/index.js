const { PrismaClient } = require('@prisma/client')
const assert = require('assert')

module.exports = async () => {
  const prisma = new PrismaClient()

  await prisma.user.findMany()
  prisma.$disconnect()
  const a = await prisma.user.findMany()
  prisma.$disconnect()

  return a
}

if (require.main === module) {
  module.exports()
}
