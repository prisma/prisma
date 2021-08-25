import { PrismaClient } from './@prisma/client'

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
})

async function main() {
  await prisma.post.create({
    data: {
      title: 'TEST',
      content: 'hello',
      authorId: 1,
    },
  })

  const users = await Promise.all([
    // This will be batched:
    prisma.user.findUnique({ where: { id: 1 } }),
    prisma.user.findUnique({ where: { id: 2 } }),
  ])

  console.dir(users, { depth: null })
}

main().finally(async () => {
  await prisma.$disconnect()
})
