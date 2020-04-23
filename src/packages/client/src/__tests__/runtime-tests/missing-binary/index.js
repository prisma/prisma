const { PrismaClient } = require('@prisma/client')
const assert = require('assert')
const { getPlatform } = require('@prisma/get-platform')
const fs = require('fs')
const path = require('path')
const stripAnsi = require('strip-ansi')

module.exports = async () => {
  const platform = await getPlatform()
  const binaryPath = path.join(
    __dirname,
    'node_modules/.prisma/client',
    `query-engine-${platform}`,
  )
  fs.unlinkSync(binaryPath)

  try {
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
  } catch (e) {
    throw new Error(
      stripAnsi(
        e.message
          .split('\n')
          .slice(3)
          .trim()
          .join('\n')
          .replace(/looked in.*\)/, 'looked in xxx)')
          .replace(platform, 'PLATFORM'),
      ),
    )
  }
}

if (require.main === module) {
  module.exports()
}
