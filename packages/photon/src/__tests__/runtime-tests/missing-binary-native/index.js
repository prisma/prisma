const { PrismaClient } = require('@prisma/client')
const assert = require('assert')
const { getPlatform } = require('@prisma/get-platform')
const fs = require('fs')
const path = require('path')
const stripAnsi = require('strip-ansi')

module.exports = async () => {
  const platform = await getPlatform()
  const pkgJsonPath = require.resolve('@prisma/client/package.json')
  const binaryPath = path.join(
    path.dirname(pkgJsonPath),
    'runtime',
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
          .replace(/Invalid.*invocation.*\n.*\n/m, 'Invalid invocation')
          .replace(/looked in.*\)/, 'looked in xxx)')
          .replace(platform, 'PLATFORM'),
      ),
    )
  }
}

if (require.main === module) {
  module.exports()
}
