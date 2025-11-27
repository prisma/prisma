import { PrismaLibSql } from '@prisma/adapter-libsql'

import { createMemoryTest } from '../_utils/createMemoryTest'

//@ts-ignore
type PrismaModule = typeof import('./.generated/node_modules/@prisma/client')

void createMemoryTest({
  async prepare({ PrismaClient }: PrismaModule) {
    const client = new PrismaClient({
      adapter: new PrismaLibSql({ url: `file:${__dirname}/../dev.db` }),
    })
    await client.$connect()
    for (let i = 0; i < 1000; i++) {
      await client.user.create({
        data: {
          viewCount: Math.floor(Math.random() * 50_000),
        },
      })
    }
    return client
  },
  async run(client) {
    await client.user.findMany()
  },
  async cleanup(client) {
    await client.$disconnect()
  },
})
