const { PrismaClient } = require('@prisma/client')

async function doPrismaQuery() {
  const prisma = new PrismaClient()

  await prisma.user.deleteMany()
  const user = await prisma.user.create({
    data: {
      email: 'test',
    },
  })

  return user
}

export default async function handle(req, res) {
  res.json({ user: await doPrismaQuery() })
}
