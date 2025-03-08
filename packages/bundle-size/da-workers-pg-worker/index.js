import { PrismaPg } from '@prisma/adapter-pg-worker'
import { Pool } from '@prisma/pg-worker'

import { PrismaClient } from './client/wasm'

export default {
  async fetch(_request, env) {
    const pool = new Pool({ connectionString: env.DATABASE_URL })
    const adapter = new PrismaPg(pool)
    const prisma = new PrismaClient({ adapter })

    const users = await prisma.user.findMany()
    const result = JSON.stringify(users)

    // eslint-disable-next-line no-undef
    return new Response(result)
  },
}
