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
    // make sure, that it's a PrismaClientInitializationError
    if (e instanceof PrismaClientInitializationError) {
      throw e
    }
  }
}
