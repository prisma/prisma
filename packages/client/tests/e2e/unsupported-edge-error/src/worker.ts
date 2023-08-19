import { PrismaClient } from '@prisma/client'

export interface Env {}

export default {
  async fetch(): Promise<Response> {
    try {
      const prisma = new PrismaClient()

      await prisma.user.findMany()
    } catch (e: any) {
      return new Response(e.message)
    }

    return new Response('No Error')
  },
}
