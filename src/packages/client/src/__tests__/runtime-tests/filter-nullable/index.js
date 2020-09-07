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

  assert.strictEqual(result.length, 2, "Should return 2 Sale rows")

  db.$disconnect()
}

if (require.main === module) {
  module.exports()
}
