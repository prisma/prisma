import { PrismaClient, PromiseReturnType } from './@prisma/client'

const prisma = new PrismaClient()

function getUsers() {
  return prisma.user.findMany({
    first: 10,
    select: {
      id: true,
    },

    orderBy: {
      email: 'asc',
      // id: 'asc'
    },

    // include: {
    //   posts: true
    // }
  })
}

export type Users = PromiseReturnType<typeof getUsers>

async function main() {
  const users = await prisma.user.findMany({
    first: 10,
    // select: {
    //   id: true,
    // },

    orderBy: {
      email: 'asc',
      // id: 'asc'
    },

    include: {
      posts: true,
    },
  })

  console.log(users)

  // const resolvedUsers = await Promise.all(
  //   users.map(u =>
  //     prisma.user.findOne({
  //       where: {
  //         id: u.id,
  //       },
  //     }),
  //   ),
  // )

  // console.log(resolvedUsers.length)
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
