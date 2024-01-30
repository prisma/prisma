import { Client } from '@planetscale/database'
import { PrismaPlanetScale } from '@prisma/adapter-planetscale'

import { PrismaClient } from './client/wasm'

export default {
  async fetch(request, env) {
    const client = new Client({
      url: env.DATABASE_URL,
      fetch(url, init) {
        delete init['cache']
        return fetch(url, init)
      },
    })
    const adapter = new PrismaPlanetScale(client)
    const prisma = new PrismaClient({ adapter })

    const users = await prisma.user.findMany()
    const result = JSON.stringify(users)

    // eslint-disable-next-line no-undef
    return new Response(result)
  },
}
