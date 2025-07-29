import { PrismaPlanetScale } from '@prisma/adapter-planetscale'

import { PrismaClient } from './client/wasm'

export default {
  async fetch(request, env) {
    const adapter = new PrismaPlanetScale({
      url: env.DATABASE_URL,
      fetch(url, init) {
        delete init['cache']
        return fetch(url, init)
      },
    })
    const prisma = new PrismaClient({ adapter })

    const users = await prisma.user.findMany()
    const result = JSON.stringify(users)

    // eslint-disable-next-line no-undef
    return new Response(result)
  },
}
