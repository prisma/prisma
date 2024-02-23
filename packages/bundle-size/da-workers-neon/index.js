import { PrismaNeon } from '@prisma/adapter-neon'
import { createPool } from '@vercel/postgres'

import { PrismaClient } from './client/wasm'

export default {
  async fetch(request, env) {
    const pool = createPool({ connectionString: env.DATABASE_URL })
    const adapter = new PrismaNeon(pool)
    const prisma = new PrismaClient({ adapter })

    const users = await prisma.user.findMany()
    const result = JSON.stringify(users)

    // eslint-disable-next-line no-undef
    return new Response(result)
  },
}
