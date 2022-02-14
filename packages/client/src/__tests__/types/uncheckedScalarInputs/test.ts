import { PrismaClient } from '@prisma/client'

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const prisma = new PrismaClient()

  await prisma.user.create({
    data: {
      email: 'a@a.de',
      posts: {
        create: {
          published: false,
          title: 'hi',
        },
      },
    },
  })

  await prisma.post.create({
    data: {
      title: '',
      published: true,
      author: {
        create: {
          email: 'a@a.de',
        },
      },
    },
  })

  await prisma.post.create({
    data: {
      title: '',
      published: true,
      authorId: 'a@a.de',
    },
  })
}

main().catch((e) => {
  console.error(e)
})
