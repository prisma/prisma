import { PrismaClient } from './prisma/generated/client'

const prisma = new PrismaClient()

async function main() {
  const email = `user.${Date.now()}@prisma.io`
  const newUser = await prisma.user.create({
    data: {
      email: email,
    },
  })
  console.log('✅ New user created:', newUser)

  const users = await prisma.user.findMany()
  console.log(`📊 Total users in database: ${users.length}`)
}

void main().catch((e) => {
  console.log(e.message)
  process.exit(1)
})
