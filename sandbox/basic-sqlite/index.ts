import { Prisma, PrismaClient } from '.prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaLibSQL(
      createClient({
        url: 'file:./prisma/dev.db',
      }),
    ),
  })

  const email = `user.${Date.now()}@prisma.io`
  await prisma.user.create({
    data: { email },
  })

  const query = prisma.user.findMany({
    where: {
      createdAt: {
        gt: Prisma.Param('startDate'),
      },
    },
  })

  console.log(await prisma.$debugQueryPlan(query))

  const compiledQuery = await prisma.$prepare(query)

  console.log(
    'last day:',
    (
      await compiledQuery({
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      })
    ).length,
  )

  console.log(
    'last second:',
    await compiledQuery({
      startDate: new Date(Date.now() - 1000).toISOString(),
    }),
  )

  // --------------
  // timings
  // --------------

  // warm up native connector
  await prisma.user.findMany()

  console.time('old way')
  await prisma.user.findMany()
  console.timeEnd('old way')

  console.time('compilation')
  const findAllCompiled = await prisma.$prepare(prisma.user.findMany())
  console.timeEnd('compilation')

  console.time('compiled')
  await findAllCompiled({})
  console.timeEnd('compiled')

  /// --------------
  /// misc
  /// --------------

  // console.log(
  //   await prisma.$debugQueryPlan(
  //     prisma.user.findMany({
  //       where: {
  //         email: Prisma.Param('email'),
  //         createdAt: {
  //           gt: Prisma.Param('startDate'),
  //         },
  //       },
  //     }),
  //   ),
  // )

  // const newQuery = await prisma.$prepare(
  //   prisma.user.findMany({
  //     where: {
  //       email: Prisma.Param('email'),
  //       createdAt: {
  //         gt: Prisma.Param('startDate'),
  //       },
  //     },
  //   }),
  // )

  // console.log(
  //   await newQuery({
  //     email: 'user.1730130638271@prisma.io',
  //     startDate: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  //   }),
  // )
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
