import { Prisma, PrismaClient } from '.prisma/client'

async function main() {
  const prisma = new PrismaClient()

  const email = `user.${Date.now()}@prisma.io`
  await prisma.user.create({
    data: {
      email: email,
    },
  })

  // const promiseFindManyUser = prisma.user.findMany()

  const result$DebugQueryPlan = prisma.$debugQueryPlan(
    prisma.user.findMany({
      where: {
        email: 'foo@prisma.io',
      },
    }),
  )

  console.log(
    'result$DebugQueryPlan',
    await result$DebugQueryPlan,
  )

  // // @ts-ignore
  // const query = prisma.$prepare(prisma.user.findMany())
  // console.log('result', await query({ fieldA: 'foo', fieldB: 'bar' }))

  // // @ts-ignore
  // const query2 = prisma.$prepare(prisma.user.findFirst())
  // console.log('result', await query2({ fieldA: 'foo', fieldB: 'bar' }))

  // // console.log(users)
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
