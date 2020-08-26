const { PrismaClient } = require('@prisma/client')
const assert = require('assert')

module.exports = async () => {
  const prisma = new PrismaClient()

  await prisma.user.findMany()
  prisma.$disconnect()
  const a = await prisma.user.findMany()

  return a
}

if (require.main === module) {
  module.exports()
}
