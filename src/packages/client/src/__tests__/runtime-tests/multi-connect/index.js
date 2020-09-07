const { PrismaClient } = require('@prisma/client')
const assert = require('assert')

module.exports = async () => {
  const prisma = new PrismaClient()

  await prisma.user.findMany()
  const a = prisma.user.findMany()
  prisma.$disconnect()
  await prisma.$disconnect()
  prisma.$disconnect()
  await prisma.$connect()
  prisma.$connect()

  await a
  const result = await prisma.user.findMany()

  await prisma.$disconnect()
  return result
}

if (require.main === module) {
  module.exports()
}
