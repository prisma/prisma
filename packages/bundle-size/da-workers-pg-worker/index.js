// These differ from real-life imports because of our setup. In real life:
// import { PrismaPg } from '@prisma/adapter-pg'
// import { Pool } from 'pg'
//
// And `pg` can be installed in two different ways (traditional or override):
// - `"pg": "8.6.0"`
// - `"pg": "npm:@prisma/pg-worker@5.13.0"`

import { PrismaPg } from '@prisma/adapter-pg-worker'
import { Pool } from '@prisma/pg-worker'

import { PrismaClient } from './client/wasm'

export default {
  async fetch(request, env) {
    const pool = new Pool({ connectionString: env.DATABASE_URL })
    const adapter = new PrismaPg(pool)
    const prisma = new PrismaClient({ adapter })

    const users = await prisma.user.findMany()
    const result = JSON.stringify(users)

    // eslint-disable-next-line no-undef
    return new Response(result)
  },
}
