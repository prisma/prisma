import { PrismaClient, User } from '@prisma/client'

// tslint:disable

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const prisma = new PrismaClient()
  await prisma.$transaction([
    prisma.user.aggregate({ where: { email: '' } }),
    prisma.user.count(),
    prisma.user.create({ data: { email: '' } }),
    prisma.user.delete({ where: { email: '' } }),
    prisma.user.findMany(),
    prisma.user.update({ data: { email: '' }, where: { email: '' } }),
    prisma.user.upsert({
      create: { email: '' },
      update: { email: '' },
      where: { email: '' },
    }),

    prisma.$queryRaw`SELECT 1`,
    prisma.$executeRawUnsafe(''),
  ])
  // Test Type Fallback
  const txs = [prisma.user.findMany(), prisma.user.findFirst()]
  const res: (User | User[] | null)[] = await prisma.$transaction(txs)
}

main().catch((e) => {
  console.error(e)
})
