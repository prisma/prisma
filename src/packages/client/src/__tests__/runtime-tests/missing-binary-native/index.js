const { PrismaClient } = require('@prisma/client')
const { getPlatform } = require('@prisma/get-platform')
const fs = require('fs')
const path = require('path')

module.exports = async () => {
  const platform = await getPlatform()
  const pkgJsonPath = require.resolve('@prisma/client/package.json')
  const binaryPath = path.join(
    __dirname,
    'node_modules/.prisma/client',
    `query-engine-${platform}`,
  )
  fs.unlinkSync(binaryPath)

  const prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
    ],
  })

  await prisma.user.findMany()

  prisma.disconnect()
}

if (require.main === module) {
  module.exports()
}
