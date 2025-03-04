import { Prisma, PrismaClient } from '.prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

import util from 'node:util'

async function main() {
  const prisma = new PrismaClient({
    log: ['query'],
    adapter: new PrismaPg(
      new Pool({
        connectionString: process.env.TEST_POSTGRES_URI,
      }),
    ),
  })

  const email = `user.${Date.now()}@prisma.io`
  const user = await prisma.user.create({
    data: { email },
  })

  await prisma.post.createMany({
    data: [
      {
        title: 'First post',
        userId: user.id,
      },
      {
        title: 'Second post',
        userId: user.id,
      },
    ],
  })

  const query = prisma.user.findMany({
    where: {
      createdAt: {
        gt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
    },
  })

  const nestedQuery = await prisma.user.findMany({
    include: {
      posts: true,
    },
  })

  console.log(util.inspect(nestedQuery, { depth: null }))

  // --------------
  // timings
  // --------------

  // warm up native connector
  await prisma.user.findMany()

  // console.time('old way')
  const [, timing] = await benchmark(() => query)
  // console.timeEnd('old way')
  console.log('timing', timing)

  /// --------------
  /// misc
  /// --------------

  // console.log(
  //   await newQuery({
  //     email: 'user.1730130638271@prisma.io',
  //     startDate: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  //   }),
  // )
}

const benchmark = async <T>(fn: () => Promise<T>): Promise<[result: T, ms: number]> => {
  const start = process.hrtime.bigint()
  const result = await fn()
  const end = process.hrtime.bigint()
  const ms = Number(end - start) / 1e6 // Duration in milliseconds

  return [result, ms]
}

void main()
  .then(() => {
    console.log('✅ done')
    process.exit(0)
  })
  .catch((e) => {
    console.log('❌ error')
    console.error(e)
    process.exit(1)
  })
