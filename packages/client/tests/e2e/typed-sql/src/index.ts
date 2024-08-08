import { PrismaClient } from '@prisma/client'
import { getEmail } from '@prisma/client/sql'

async function main() {
  const prisma = new PrismaClient()

  const { id } = await prisma.user.create({
    data: { email: 'john@doe.io' },
  })

  const userRaw = await prisma.$queryRawTyped(getEmail(id))

  console.log(userRaw)
}

void main()
