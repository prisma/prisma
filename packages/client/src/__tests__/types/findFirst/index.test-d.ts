import { PrismaClient } from '.'
import { expectError } from 'tsd'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:dev.db',
    },
  },
})

;(async () => {
  expectError(
    await prisma.user.findFirst({
      prop: true,
    }),
  )

  expectError(
    await prisma.user.findFirst({
      include: {
        posts: true,
      },
      select: {
        id: true,
      },
    }),
  )
})()
