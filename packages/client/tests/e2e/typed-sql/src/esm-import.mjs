import { PrismaClient } from '@prisma/client'
import { getEmail } from '@prisma/client/sql'

const prisma = new PrismaClient()

const { id } = await prisma.user.create({
  data: { email: 'john-esm@doe.io' },
})

const userRaw = await prisma.$queryRawTyped(getEmail(id))

console.log(userRaw)
