const { PrismaClient } = require('@prisma/client')

module.exports = async () => {
  const prisma = new PrismaClient({
    errorFormat: 'colorless',
  })
  await prisma.connect()
}
