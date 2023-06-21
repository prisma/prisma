const path = require('path')

class PrismaClient {
  constructor() {
    throw new Error(
      `@prisma/client did not initialize yet. Please run "prisma generate" and try to import it again.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
    )
  }
}

function defineExtension(ext) {
  if (typeof ext === 'function') {
    return ext
  }

  return (client) => client.$extends(ext)
}

function getExtensionContext(that) {
  return that
}

module.exports = {
  PrismaClient,
  Prisma: {
    defineExtension,
    getExtensionContext,
    get prismaVersion() {
      const atPrismaClientDir = path.dirname(require.resolve('@prisma/client/package.json'))
      const enginesVersionDir = require.resolve('@prisma/engines-version', { paths: [atPrismaClientDir] })
      const { version: client } = require('@prisma/client/package.json')
      const { enginesVersion: engine } = require(enginesVersionDir)

      return { client, engine }
    },
  },
}
