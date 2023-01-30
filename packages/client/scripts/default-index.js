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
  },
}
