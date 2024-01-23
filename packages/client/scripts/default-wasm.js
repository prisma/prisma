class PrismaClient {
  constructor() {
    throw new Error(
      `To use @prisma/client in an edge runtime, enable \`driverAdapters\` in your Prisma schema and run \`prisma generate\`.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues/new`,
    )
  }
}

module.exports = {
  PrismaClient,
}
