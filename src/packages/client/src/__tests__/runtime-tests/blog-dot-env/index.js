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
    throw e
  }
}
