import { copycat } from '@snaplet/copycat'

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
    const data = Array.from({ length: 50 }, () => {
      return {
        email: copycat.email(81),
      }
    })

    await client.user.createMany({ data })
  },
  async cleanup(client) {
    await client.$disconnect()
  },
})
