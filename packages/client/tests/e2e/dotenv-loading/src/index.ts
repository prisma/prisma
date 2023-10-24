import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()

  const user = await prisma.user.create({
    data: { email: 'john@doe.io' },
  })

  console.log(user)
}

void main()
