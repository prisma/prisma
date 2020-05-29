const { PrismaClient } = require('@prisma/client')
const assert = require('assert')

module.exports = async () => {
  const db = new PrismaClient({
    errorFormat: 'colorless',
  })

  await db.user.findMany()

  db.engine.child.kill()

  await new Promise((r) => setTimeout(r, 1000))

  const result = await db.user.findMany()
  assert(result.length > 0)

  db.disconnect()
}

if (require.main === module) {
  module.exports()
}
