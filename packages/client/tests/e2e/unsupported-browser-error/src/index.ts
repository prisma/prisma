import { PrismaClient } from '@prisma/client'

export async function call() {
  try {
    const prisma = new PrismaClient()

    await prisma.user.findMany()
  } catch (e: any) {
    return e.message
  }
}
