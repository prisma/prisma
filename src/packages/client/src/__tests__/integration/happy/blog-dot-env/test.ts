import { getTestClient } from '../../../../utils/getTestClient'

test('blog-dot-env', async () => {
  const PrismaClient = await getTestClient()
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
