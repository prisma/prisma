class PrismaClient {
  constructor() {
    throw new Error(
      `@prisma/client/deno/edge did not initialize yet. Please run "prisma generate" and try to import it again.
In case this error is unexpected for you, please report it in https://github.com/prisma/prisma/issues`,
    )
  }
}

export { PrismaClient }
