// Import from the local generated client
import { PrismaClient } from './prisma/generated/client/client'
const prisma = new PrismaClient()

async function main() {
  const email = `user.${Date.now()}@prisma.io`
  await prisma.user.create({
    data: {
      email: email,
    },
  })

  const users = await prisma.user.findMany()
  console.log('✅ Success! User created:', users)
}

void main().catch((e) => {
  console.log(e.message)
  process.exit(1)
})