import { PrismaClient } from './@prisma/client'

const prisma = new PrismaClient({
  errorFormat: 'pretty',
})

async function main() {
  ;(prisma as any).use('all', async ({ params, fetch }) => {
    console.log(params.clientMethod, `before`, params)
    const data = await fetch(params)
    console.log(params.clientMethod, data)
    data.push({
      name: 'fake user',
    })
    console.log(params.clientMethod, `after`)
    return data
  })
  const users = await prisma.transaction([
    prisma.user.findMany({
      include: {
        posts: {
          include: {
            author: true,
          },
          orderBy: {
            title: 'asc',
          },
        },
      },
    }),
    prisma.user.findMany({
      include: {
        posts: {
          include: {
            author: true,
          },
          orderBy: {
            title: 'asc',
          },
        },
      },
    }),
  ])

  prisma.post.create({
    data: {
      author: {
        connectOrCreate: {
          where: {
            email: 'a@a.de',
          },
          create: {
            email: 'a@a.de',
          },
        },
      },
      published: true,
      title: 'Title',
    },
  })

  console.log(users)

  // const result = await prisma.user.updateMany({
  //   data: {
  //     id: null,
  //   },
  // })

  // console.log(result)

  // // prisma.disconnect()

  // const user = await prisma.post.findOne({
  //   include: {
  //     author: true,
  //   },
  //   where: {
  //     id: '',
  //   },
  // })

  // const x = await prisma.post.update({
  //   where: {
  //     id: '',
  //   },
  //   data: {
  //     id: '',
  //     published: true,
  //     title: null,
  //   },
  // })

  // prisma.post.findMany({
  //   where: {
  //     title: null,
  //   },
  // })
}

main().catch((e) => {
  console.error(e)
})
