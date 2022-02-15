import { expectError } from 'tsd'

import { PrismaClient } from '.'

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
