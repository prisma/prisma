class PrismaClient {
  constructor() {
    throw new Error(
      `@prisma/client/deno/edge did not initialize yet. Please run "prisma generate" and try to import it again.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
    )
  }
}

export { PrismaClient }
