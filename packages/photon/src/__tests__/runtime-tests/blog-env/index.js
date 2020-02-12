const {
  PrismaClient,
  PrismaClientInitializationError,
} = require('@prisma/client')

module.exports = async () => {
  const prisma = new PrismaClient({
    errorFormat: 'colorless',
  })
  try {
    await prisma.connect()
  } catch (e) {
    if (!e instanceof PrismaClientInitializationError) {
      throw new Error(
        `Error should be instance of PrismaClientInitializationError`,
      )
    }
  }
}
