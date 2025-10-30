import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaBetterSqlite3({
  url: './prisma/dev.db',
})

test('vercel env var + manual generate', () => {
  const prisma = new PrismaClient({ adapter })
  prisma.$connect()
})
