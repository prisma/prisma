import { setTimeout } from 'node:timers/promises'

import { createMemoryTest } from '../_utils/createMemoryTest'

//@ts-ignore
type PrismaModule = typeof import('./.generated/node_modules/@prisma/client')

const numberOfQueries = 200

createMemoryTest({
  async prepare({ PrismaClient, Prisma }: PrismaModule) {
    const PRISMA_EMPTY_STRING = Prisma.sql` `
    const client = new PrismaClient()
    await client.$connect()

    return { client, Prisma, PRISMA_EMPTY_STRING }
  },

  async run({ client, Prisma, PRISMA_EMPTY_STRING }) {
    const f = (elements: any) => {
      const els = elements.map((element: any) => Prisma.sql`${element} as "${element}"`)
      els.push(PRISMA_EMPTY_STRING)
      return client.$queryRaw`SELECT ${els}`
    }

    for (let i = 0; i < numberOfQueries; i++) {
      const args = Array.from({ length: 20 }, () => 0).map((_, index) =>
        index % 2 === 0 ? (Math.round(Math.random() * 100) + 36).toString(36) : index,
      )

      // console.log('going to query')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const result = await f(args)
      // console.dir(result)
      // console.log('queried')
      await setTimeout(10)
    }

    await client.$disconnect()
  },
})
