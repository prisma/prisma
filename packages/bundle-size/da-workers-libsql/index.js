import { createClient } from '@libsql/client/web'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

import { PrismaClient } from './client/wasm'

export default {
  async fetch(_request, env) {
    const client = createClient({
      url: env.DRIVER_ADAPTERS_TURSO_CF_BASIC_DATABASE_URL,
      authToken: env.DRIVER_ADAPTERS_TURSO_CF_BASIC_TOKEN,
    })
    const adapter = new PrismaLibSQL(client)
    const prisma = new PrismaClient({ adapter })

    const users = await prisma.user.findMany()
    const result = JSON.stringify(users)

    // eslint-disable-next-line no-undef
    return new Response(result)
  },
}
