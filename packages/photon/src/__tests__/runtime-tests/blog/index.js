const { PrismaClient } = require('@prisma/client')

module.exports = async () => {
  const prisma = new PrismaClient({
    errorFormat: 'colorless',
    __internal: {
      measurePerformance: true,
    },
  })
  await prisma.user.findMany()
  prisma.disconnect()
  await prisma.user.findMany()
  prisma.disconnect()
  prisma.connect()
  await prisma.disconnect()
  await new Promise(r => setTimeout(r, 200))
  prisma.connect()

  const userPromise = prisma.user.findMany()
  await userPromise
  // @ts-ignore
  const perfResults = userPromise._collectTimestamps.getResults()
  if (Object.keys(perfResults).length === 0) {
    throw Error('measurePerformance is enabled but results object is empty')
  }
  prisma.disconnect()
}

if (require.main === module) {
  module.exports()
}
