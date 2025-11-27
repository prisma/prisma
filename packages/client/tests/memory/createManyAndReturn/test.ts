import { faker } from '@faker-js/faker'
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
    const data = Array.from({ length: 50 }, () => {
      return {
        email: faker.internet.email(),
      }
    })

    await client.user.createManyAndReturn({ data })
  },
  async cleanup(client) {
    await client.$disconnect()
  },
})
