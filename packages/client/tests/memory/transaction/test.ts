import { createMemoryTest } from '../_utils/createMemoryTest'

//@ts-ignore
type PrismaModule = typeof import('./.generated/node_modules/@prisma/client')

void createMemoryTest({
  async prepare({ PrismaClient }: PrismaModule) {
    const client = new PrismaClient()
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
