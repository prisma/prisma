import { PrismaClient } from '@prisma/client'

export interface Env {}

export default {
  async fetch(): Promise<Response> {
    // outside of try/catch, error has to happens on access only
    const prisma = new PrismaClient()

    try {
      await prisma.user.findMany()
    } catch (e: any) {
      return new Response(e.message)
    }

    return new Response('No Error')
  },
}
