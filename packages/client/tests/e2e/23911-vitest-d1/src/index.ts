import { D1Database, ExecutionContext } from '@cloudflare/workers-types'

import { getPrisma } from './prismaClient'

export interface Env {
  DB: D1Database
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const prisma = getPrisma(env.DB)

    const result = await prisma.user.findMany()

    if (result.length === 0) {
      await prisma.user.create({
        data: {
          name: 'Paul Atreides',
        },
      })
    }

    return new Response(JSON.stringify(result))
  },
}
