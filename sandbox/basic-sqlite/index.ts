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
        // @ts-ignore
        gt: Prisma.Param('startDate'),
      },
    },
  })

  console.log(
    // @ts-ignore
    await prisma.$debugQueryPlan(query),
  )

  // @ts-ignore
  const compiledQuery = await prisma.$prepare(query)

  console.log(
    await compiledQuery({
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    }),
  )
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
