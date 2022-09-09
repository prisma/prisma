import { faker } from '@faker-js/faker'

import { createMemoryTest } from '../_utils/createMemoryTest'

//@ts-ignore
type PrismaModule = typeof import('./.generated/node_modules/@prisma/client')

void createMemoryTest({
  async prepare({ PrismaClient }: PrismaModule) {
    const client = new PrismaClient()
    await client.$connect()

    for (let i = 0; i < 5000; i++) {
      await client.teams.create({
        data: {
          key: faker.lorem.word(),
          title: faker.lorem.sentence(),
          created_at: new Date(),
          updated_at: new Date(),
          country_id: 0,
        },
      })
    }
    return client
  },
  async run(client) {
    await client.teams.findMany({})
  },
  async cleanup(client) {
    await client.$disconnect()
  },
})
