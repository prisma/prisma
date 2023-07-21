import { generateTestClient } from '../../../../utils/getTestClient'

test('blog-dot-env-both', async () => {
  await generateTestClient()

  const { PrismaClient } = require('./node_modules/@prisma/client')
  const prisma = new PrismaClient({
    errorFormat: 'colorless',
  })

  if (process.env.SQLITE_URL_FROM_DOT_ENV_FILE) {
    throw new Error('SQLITE_URL_FROM_DOT_ENV_FILE should not be set here.')
  }

  try {
    await prisma.$connect()
  } finally {
    await prisma.$disconnect()
  }
})
