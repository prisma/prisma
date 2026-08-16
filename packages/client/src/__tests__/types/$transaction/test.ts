import type { User } from '@prisma/client'
import { PrismaClient, Prisma } from '@prisma/client'

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

  // Interactive transaction: the callback argument supports model operations
  // and raw queries.
  const count = await prisma.$transaction(async (tx) => {
    const users = await tx.user.findMany()
    await tx.$queryRaw`SELECT 1`
    await tx.$executeRaw`DELETE FROM "User" WHERE 1 = 1`
    return users.length
  })
  void count

  // Interactive transaction callback argument is a TransactionClient.
  const tx2: Prisma.TransactionClient = await prisma.$transaction(async (tx) => tx)
  await tx2.user.findMany()

  // PrismaClient is assignable to TransactionClient.
  const tx3: Prisma.TransactionClient = prisma
  await tx3.user.findMany()

  // `tx ?? client` is usable as a TransactionClient.
  const db = (await prisma.$transaction(async (tx) => tx)) ?? prisma
  await db.user.findMany()
  await db.$queryRaw`SELECT 1`
}

main().catch((e) => {
  console.error(e)
})
