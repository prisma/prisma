import { PrismaClient } from './@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.post.create({
    data: {
      title: 'TEST',
      content: 'hello',
      authorId: 1,
    },
  })

  const users = await prisma.user.findMany({
    include: {
      posts: true,
    },
  })

  console.dir(users, { depth: null })
}

main().finally(async () => {
  await prisma.$disconnect()
})
