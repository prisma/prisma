class PrismaClient {
  constructor() {
    throw new Error(
      `@prisma/client/edge did not initialize yet. You need to either enable Accelerate or the Data Proxy.
Enable Accelerate via \`prisma generate --accelerate\` or the Data Proxy via \`prisma generate --data-proxy.\`
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
    )
  }
}

module.exports = {
  PrismaClient,
}
