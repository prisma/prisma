import { PrismaMariaDb } from '@prisma/adapter-mariadb'

import { PrismaClient } from './client/wasm'

export default {
  async fetch(request, env) {
    const adapter = new PrismaMariaDb({
      host: env.DATABASE_URL,
    })
    const prisma = new PrismaClient({ adapter })

    const users = await prisma.user.findMany()
    const result = JSON.stringify(users)

    // eslint-disable-next-line no-undef
    return new Response(result)
  },
}
