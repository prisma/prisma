import { PrismaClient } from '@prisma/client'

test('vercel env var + manual generate', () => {
  const prisma = new PrismaClient()
  prisma.$connect()
})
