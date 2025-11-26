import { PrismaPg } from '@prisma/adapter-pg'

import { createMemoryTest } from '../_utils/createMemoryTest'

//@ts-ignore
type PrismaModule = typeof import('./.generated/node_modules/@prisma/client')

void createMemoryTest({
  async prepare({ PrismaClient }: PrismaModule) {
    const client = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.TEST_POSTGRES_URI }),
    })
    await client.$connect()
    return client
  },
  async run(client) {
    await client.$transaction(async (tx) => {
      await tx.user.findMany({})
    })
  },
  async cleanup(client) {
    await client.$disconnect()
  },
})
