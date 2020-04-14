import { PrismaClient } from './@prisma/client'

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

  console.log(users[0].posts[0].author?.id)

  // prisma.disconnect()

  const user = await prisma.post.findOne({
    include: {
      author: true,
    },
    where: {
      id: '',
    },
  })

  const x = await prisma.post.create({
    data: {
      id: '',
      published: true,
      title: '',
      content: '',
    },
    include: {
      author: {
        include: {
          posts: {
            orderBy: {
              content: 'asc',
            },
            include: {
              author: true,
            },
          },
        },
      },
    },
  })
}

main().catch(e => {
  console.error(e)
})
