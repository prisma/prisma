const { PrismaClient } = require('@prisma/client')
const assert = require('assert')

module.exports = async () => {
  const db = new PrismaClient()

  const result = await db.user.update({
    where: {
      // email: 'a@a.de',
      email: 'b@b.de',
    },
    data: {
      countInt: {
        increment: 1,
      },
      // countFloat: {
      // increment: 1.54321,
      // },
    },
  })

  assert.deepStrictEqual(result, {
    count: 10,
  })

  db.$disconnect()
}

if (require.main === module) {
  module.exports()
}
