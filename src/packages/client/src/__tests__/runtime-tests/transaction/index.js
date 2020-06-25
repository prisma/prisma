const { PrismaClient, prismaVersion } = require('@prisma/client')
const assert = require('assert')
const crypto = require('crypto')

module.exports = async () => {
  const db = new PrismaClient()

  if (!prismaVersion || !prismaVersion.client) {
    throw new Error(`prismaVersion missing: ${JSON.stringify(prismaVersion)}`)
  }

  // Test connecting and disconnecting all the time
  const result = await db.transaction([db.user.findMany(), db.user.findMany()])
  assert.equal(result.length, 2)

  const email = crypto.randomBytes(20).toString('hex') + '@hey.com'

  // intentionally use the same email 2 times to see, if the transaction gets rolled back properly
  // TODO: Handle the error here and make sure it's the right one
  try {
    await db.transaction([
      db.user.create({
        data: {
          email,
        },
      }),
      db.user.create({
        data: {
          email,
        },
      }),
    ])
  } catch (e) {
    if (!e.message.includes('P2002')) {
      throw new Error(e)
    }
  }

  const users = await db.user.findMany()
  assert.equal(users.length, 1)

  db.disconnect()
}

if (require.main === module) {
  module.exports()
}
