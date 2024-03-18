import { createMemoryTest } from '../_utils/createMemoryTest'

//@ts-ignore
type PrismaModule = typeof import('./.generated/node_modules/@prisma/client')
createMemoryTest({
  prepare(module: PrismaModule) {
    return module.PrismaClient
  },

  async run(PrismaClient) {
    const client = new PrismaClient()
    await client.$connect()
    await client.$disconnect()
  },
})
