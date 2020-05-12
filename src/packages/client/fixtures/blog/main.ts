import { PrismaClient } from './@prisma/client'

const prisma = new PrismaClient({
  errorFormat: 'pretty',
})

async function main() {
  // const users = await prisma.user.findMany({
  //   where: {
  //     id: null,
  //   },
  //   include: {
  //     posts: {
  //       include: {
  //         author: true,
  //       },
  //       orderBy: {
  //         title: 'asc',
  //       },
  //     },
  //   },
  // })

  // console.log(users)

  const result = await prisma.user.updateMany({
    data: {
      id: null,
    },
  })

  console.log(result)

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
