import { generateTestClient } from '../../../../utils/getTestClient'

test('blog-dot-env-both', async () => {
  await generateTestClient()

  const {
    PrismaClient,
  } = require('./node_modules/@prisma/client')
  const prisma = new PrismaClient({
    errorFormat: 'colorless',
  })
  try {
    await prisma.$connect()
  } catch (e) {
    throw e
  } finally {
    prisma.$disconnect()
  }
})
