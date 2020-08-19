const { PrismaClient } = require('@prisma/client')
const assert = require('assert')

module.exports = async () => {
  const db = new PrismaClient()

  const prisma = new PrismaClient()
  const result = await prisma.sale.findMany({
    where: {
      resale: null
    },
  })

  console.log(result)

  db.$disconnect()
}

if (require.main === module) {
  module.exports()
}
