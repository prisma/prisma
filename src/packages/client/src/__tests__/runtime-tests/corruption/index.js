const { PrismaClient } = require('@prisma/client')
const { getPlatform } = require('@prisma/get-platform')
const fs = require('fs')
const path = require('path')

module.exports = async () => {
  try {
    const platform = await getPlatform()
    const binaryPath = path.join(
      __dirname,
      'node_modules/.prisma/client',
      `query-engine-${platform}`,
    )
    fs.writeFileSync(binaryPath, 'hello world')

    const prisma = new PrismaClient({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
      ],
    })

    const data = await prisma.user.findMany()

    prisma.disconnect()
  } catch (e) {
    if (!e.message.includes('not found')) {
      throw new Error(`Invalid error message for binary corruption: ${e}`)
    }
  }
}

if (require.main === module) {
  module.exports()
}
