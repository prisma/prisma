import { PrismaClient, User } from '@prisma/client'

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const prisma = new PrismaClient()

  const users = await prisma.user.findMany({
    include: {
      _count: true,
    },
  })

  const postsCount: number = users[0]._count.posts
  const likeCount: number = users[0]._count.Like
}

main().catch((e) => {
  console.error(e)
})
