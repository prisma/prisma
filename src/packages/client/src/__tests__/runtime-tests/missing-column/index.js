const { PrismaClient } = require('@prisma/client')

module.exports = async () => {
  const prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
    ],
  })
  try {
    await prisma.user.findMany()
  } catch (e) {
    prisma.disconnect()
    throw e
  }
}

if (require.main === module) {
  module.exports()
}
