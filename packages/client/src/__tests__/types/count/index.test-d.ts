import { PrismaClient } from '.'
import { expectError } from 'tsd'

// tslint:disable

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:dev.db',
    },
  },
})

;(async () => {
  expectError(
    await prisma.user.count({
      select: 0,
    }),
  )

  expectError(
    await prisma.user.count({
      where: {
        name: { not: null },
      },
      select: {
        $all: true,
      },
    }),
  )
})()
