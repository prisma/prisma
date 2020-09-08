const { PrismaClient } = require('@prisma/client')
const assert = require('assert')

module.exports = async () => {
  const prisma = new PrismaClient()
  const result = await prisma.sale.findMany({
    where: {
      resale: null,
    },
  })

  assert.deepStrictEqual(result, [
    { id: '1', resaleId: null },
    { id: '2', resaleId: null },
  ])

  prisma.$disconnect()
}

if (require.main === module) {
  module.exports()
}
