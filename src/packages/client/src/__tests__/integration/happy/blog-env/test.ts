import { PrismaClientInitializationError } from '../../../../runtime'
import { getTestClient } from '../../../../utils/getTestClient'

test('blog-env', async () => {
  const env = require('./env.json')
  Object.assign(process.env, env)
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient({
    errorFormat: 'colorless',
  })
  try {
    await prisma.$connect()
  } catch (e) {
    // make sure, that it's a PrismaClientInitializationError
    if (e instanceof PrismaClientInitializationError) {
      throw e
    }
  } finally {
    await prisma.$disconnect()
  }
})
