import { PrismaClient } from '@prisma/client'
import { simpleExtension } from 'simple-ext'

function main() {
  const prisma = new PrismaClient().$extends(simpleExtension)

  const user = prisma.user.simpleCall({
    where: {
      email: 'a',
      // @ts-expect-error
      nonExistentField: 2,
    },
  })
}

void main()
