import { Pool } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'

import { PrismaClient } from './client/wasm'

export default {
  async fetch(_request, env) {
    const neon = new Pool({ connectionString: env.DATABASE_URL })
    const adapter = new PrismaNeon(neon)
    const prisma = new PrismaClient({ adapter })

    const users = await prisma.user.findMany()
    const result = JSON.stringify(users)

    // eslint-disable-next-line no-undef
    return new Response(result)
  },
}
