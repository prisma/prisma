import { PrismaClient } from '../generated/client'

export async function somePrismaCall() {
  const prisma = new PrismaClient()

  const user = await prisma.user.create({
    data: { email: 'john@doe.io' },
  })

  return user
}
