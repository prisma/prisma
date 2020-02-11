import { PrismaClient } from './@prisma/client'
import { performance } from 'perf_hooks'

async function main() {
  const prisma = new PrismaClient({
    // log: ['query', 'info', 'warn'],
    // __internal: {debug: true}
    __internal: {
      measurePerformance: true,
    },
  })

  // const rawQuery = await prisma.raw`SELECT 1`
  // console.log({rawQuery})

  const users = await prisma.user.findMany()
  const resolvedUsers = await Promise.all(
    users.map(u =>
      prisma.user.findOne({
        where: {
          id: u.id,
        },
      }),
    ),
  )

  console.log(resolvedUsers.length)
  // for (let i = 0; i < 10000; i++) {
  // await Promise.all([
  //   prisma.user.create({
  //     data: {
  //       email: 'a@a.de',
  //       name: 'Bob',
  //     },
  //   }),
  //   prisma.user.create({
  //     data: {
  //       email: 'a@a.de' + Math.random(),
  //       name: 'Bob',
  //     },
  //   }),
  // ])

  // }
  // process.exit(0)

  // const users = await prisma.user.findMany({
  //   where: {
  //     posts: null,
  //   },
  // })

  // for (let i = 0; i < 10; i++) {
  //   const users = await prisma.raw`SELECT * FROM User`
  // }

  // const n = 100

  // let total = 0
  // let elapsedTotal = 0
  // for (let i = 0; i < n; i++) {
  //   const before = performance.now()
  //   await prisma.raw`SELECT * FROM User`
  //   const after = performance.now()
  //   total += after - before
  // }

  // console.log(
  //   `Took ${total / n}ms in avg in total and for Rust ${elapsedTotal / n}ms.`,
  // )

  prisma.disconnect()
}

main().catch(e => {
  console.error(e)
})
