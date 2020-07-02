const { PrismaClient } = require('@prisma/client')
const assert = require('assert')
const { getPlatform } = require('@prisma/get-platform')
const fs = require('fs')
const path = require('path')
const stripAnsi = require('strip-ansi')

module.exports = async () => {
  try {
    const platform = await getPlatform()
    const binaryPath = path.join(
      __dirname,
      'node_modules/.prisma/client',
      `query-engine-${platform}`,
    )
    fs.truncateSync(binaryPath, 500)

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
    const message = stripAnsi(e.message)
    // https://regex101.com/r/GPVRYg/1/
    // remove the paths, so the tests can succeed on any machine
    throw new Error(message.replace(/(\/[\/\S+]+)/gm, ''))
  }
}

if (require.main === module) {
  module.exports()
}
