const { PrismaClient } = require('@prisma/client')
const assert = require('assert')

module.exports = async () => {
  const prisma = new PrismaClient()

  let result = await prisma.user.findMany({
    distinct: ['id'], // distinct on id has no effect, as it's distinct anyway
  })

  assert.equal(result.length, 10)

  result = await prisma.user.findMany({
    distinct: ['name'],
  })

  assert.equal(result.length, 1)

  prisma.disconnect()
}

if (require.main === module) {
  // seed()
  module.exports()
}
