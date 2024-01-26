class PrismaClient {
  constructor() {
    throw new Error(
      `Prisma Client is unable to run in an edge runtime. As an alternative, try Accelerate: https://pris.ly/d/accelerate.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues/new`,
    )
  }
}

module.exports = {
  PrismaClient,
}
