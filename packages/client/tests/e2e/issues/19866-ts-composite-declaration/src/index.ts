import { PrismaClient } from '@prisma/client'

export function getDbClient() {
  const client = new PrismaClient().$extends({})

  return client
}
