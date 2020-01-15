const { PrismaClient } = require('@prisma/client')

module.exports = async () => {
  const prisma = new PrismaClient({
    errorFormat: 'colorless',
    __internal: {
      measurePerformance: true,
    },
  })
  await prisma.users()
  prisma.disconnect()
  await prisma.users()
  prisma.disconnect()
  prisma.connect()
  await prisma.disconnect()
  await new Promise(r => setTimeout(r, 200))
  prisma.connect()

  const userPromise = prisma.users()
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
