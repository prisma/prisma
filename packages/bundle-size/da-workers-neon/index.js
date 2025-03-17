import { PrismaNeon } from '@prisma/adapter-neon'

import { PrismaClient } from './client/wasm'

export default {
  async fetch(request, env) {
    const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL })
    const prisma = new PrismaClient({ adapter })

    const users = await prisma.user.findMany()
    const result = JSON.stringify(users)

    // eslint-disable-next-line no-undef
    return new Response(result)
  },
}
