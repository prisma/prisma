import { PrismaMySQL2 } from '@prisma/adapter-mysql2'

import { PrismaClient } from './client/wasm'

export default {
  async fetch(request, env) {
    const adapter = new PrismaMySQL2({
      uri: env.DATABASE_URL,
    })
    const prisma = new PrismaClient({ adapter })

    const users = await prisma.user.findMany()
    const result = JSON.stringify(users)

    // eslint-disable-next-line no-undef
    return new Response(result)
  },
}
