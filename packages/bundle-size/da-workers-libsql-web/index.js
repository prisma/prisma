import { PrismaLibSQL } from '@prisma/adapter-libsql/web'

import { PrismaClient } from './client/wasm'

export default {
  async fetch(request, env) {
    const adapter = new PrismaLibSQL({
      url: env.DRIVER_ADAPTERS_TURSO_CF_BASIC_DATABASE_URL,
      authToken: env.DRIVER_ADAPTERS_TURSO_CF_BASIC_TOKEN,
    })
    const prisma = new PrismaClient({ adapter })

    const users = await prisma.user.findMany()
    const result = JSON.stringify(users)

    // eslint-disable-next-line no-undef
    return new Response(result)
  },
}
