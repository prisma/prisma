class PrismaClient {
  constructor() {
    throw new Error(
      `@prisma/client did not initialize yet. Please run "prisma2 generate" and try to import it again.`,
    )
  }
}

module.exports = {
  PrismaClient,
}
