import { D1Database } from '@cloudflare/workers-types'
import { PrismaD1 } from '@prisma/adapter-d1'
import { PrismaClient } from '@prisma/client'

export function getPrisma(DB: D1Database) {
  const adapter = new PrismaD1(DB)
  return new PrismaClient({ adapter })
}
