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

  for (let i = 0; i < 7; i++) {
    db.engine.child.kill()
    await new Promise((r) => setTimeout(r, 200))
  }
  let err
  try {
    const result = await db.user.findMany()
  } catch (e) {
    err = e
  }
  assert(
    err.message.includes(
      'Please look into the logs or turn on the env var DEBUG=* to debug the constantly restarting query engine.',
    ),
  )

  db.disconnect()
}

if (require.main === module) {
  module.exports()
}
