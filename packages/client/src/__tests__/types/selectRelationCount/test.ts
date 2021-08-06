import { PrismaClient, User } from '@prisma/client'

// tslint:disable

// This file will not be executed, just compiled to check if the typings are valid
async function main() {
  const prisma = new PrismaClient()

  const users = await prisma.user.findMany({
    include: {
      _count: true,
    },
  })

  const postsCount: number | undefined = users[0]._count?.posts
  const likeCount: number | undefined = users[0]._count?.Like
}

main().catch((e) => {
  console.error(e)
})
