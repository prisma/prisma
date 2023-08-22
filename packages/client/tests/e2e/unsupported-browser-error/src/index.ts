import { PrismaClient } from '@prisma/client'

export async function call() {
  // outside of try/catch, error has to happens on access only
  const prisma = new PrismaClient()

  try {
    await prisma.user.findMany()
  } catch (e: any) {
    return e.message
  }

  return 'No Error'
}
