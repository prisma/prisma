import { PrismaD1 } from '@prisma/adapter-d1'

import { PrismaClient } from './client/wasm'

export default {
  async fetch(_request, env) {
    const adapter = new PrismaD1(env.MY_DATABASE)
    const prisma = new PrismaClient({ adapter })

    const users = await prisma.user.findMany()
    const result = JSON.stringify(users)

    // eslint-disable-next-line no-undef
    return new Response(result)
  },
}
