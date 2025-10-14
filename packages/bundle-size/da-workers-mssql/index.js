import { PrismaMssql } from '@prisma/driver-mssql'

import { PrismaClient } from './client/wasm'

export default {
  async fetch(request, env) {
    const adapter = new PrismaMssql({
      server: env.DATABASE_URL,
    })
    const prisma = new PrismaClient({ adapter })

    const users = await prisma.user.findMany()
    const result = JSON.stringify(users)

    return new Response(result)
  },
}
