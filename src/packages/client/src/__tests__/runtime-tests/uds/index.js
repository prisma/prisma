const { PrismaClient } = require('@prisma/client')
const assert = require('assert')

module.exports = async () => {
  const prisma = new PrismaClient({
    __internal: {
      useUds: true,
    },
  })

  const result = await prisma.user.findMany()

  await prisma.$disconnect()
  return result
}

if (require.main === module) {
  module.exports()
}
