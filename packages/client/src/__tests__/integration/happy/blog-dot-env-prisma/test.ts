import { generateTestClient } from '../../../../utils/getTestClient'

test('blog-dot-env-prisma', async () => {
  await generateTestClient()

  const { PrismaClient } = require('./node_modules/@prisma/client')
  const prisma = new PrismaClient({
    errorFormat: 'colorless',
  })
  try {
    await prisma.$connect()
  } finally {
    await prisma.$disconnect()
  }
})
