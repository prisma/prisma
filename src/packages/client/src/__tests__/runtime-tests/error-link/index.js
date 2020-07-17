const { PrismaClient } = require('@prisma/client')
const assert = require('assert')
const stripAnsi = require('strip-ansi')

module.exports = async () => {
  const db = new PrismaClient({
    __internal: {
      engine: {
        enableEngineDebugMode: true,
      },
    },
  })

  try {
    await db.__internal_triggerPanic(true)
  } catch (e) {
    assert(
      stripAnsi(e.message).includes(
        'Query engine debug fatal error, shutting down.',
      ),
      'Message must include reason for failure',
    )
  }

  db.disconnect()
}

if (require.main === module) {
  module.exports()
}
