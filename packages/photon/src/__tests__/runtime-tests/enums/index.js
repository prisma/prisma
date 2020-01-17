const { PrismaClient } = require('@prisma/client')
const assert = require('assert')

module.exports = async () => {
  const prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
    ],
  })

  const queryEvents = []

  prisma.on('query', e => queryEvents.push(e))

  const result = await prisma.users({
    where: {
      favoriteTree: {
        in: ['ARBORVITAE'],
      },
    },
  })

  await prisma.disconnect()

  assert(queryEvents.length > 0)
}

if (require.main === module) {
  module.exports()
}
