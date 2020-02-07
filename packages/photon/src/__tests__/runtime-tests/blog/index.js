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
  await prisma.disconnect()

  await prisma.connect()
  const rawQuery = await prisma.raw`SELECT 1`
  if (rawQuery[0]['1'] !== 1) {
    throw Error('prisma.raw`SELECT 1` result should be [ { \'1\': 1 } ]')
  }

  try {
    const invalidRawQueryCall = await prisma.raw('SELECT 1')
  } catch (e) {
    if (!e) {
      throw new Error(`When calling raw like prisma.raw('SELECT 1') it should throw an error`)
    }
  }

  prisma.disconnect()
}

if (require.main === module) {
  module.exports()
}
