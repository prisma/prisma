import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
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
  })

  console.log(users)

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
