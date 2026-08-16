/* eslint-disable @typescript-eslint/no-floating-promises */
// (more convenient benches since we only care about types)

import { bench } from '@ark/attest'

// @ts-ignore
import type { Prisma, PrismaClient } from './generated/client'

declare const client: PrismaClient

bench.baseline(() => {
  client.model1.findUnique({
    where: { id: 1 },
  })
})

bench('transaction client: tx ?? client', () => {
  async function run() {
    const tx = await client.$transaction(async (tx) => {
      await tx.model1.findFirst()
      return tx
    })
    const db = tx ?? client
    await db.model1.findMany()
    await db.$queryRaw`SELECT 1`
  }
  void run
}).types([638, 'instantiations'])

bench('transaction client: explicit union', () => {
  const db: Prisma.TransactionClient | PrismaClient = client
  db.model1.findMany()
}).types([522, 'instantiations'])
