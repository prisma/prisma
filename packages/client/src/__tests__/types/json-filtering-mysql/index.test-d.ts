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
    await prisma.user.findFirst({
      where: {
        info: {
          path: ['any'],
        },
      },
    }),
  )
  expectError(
    await prisma.user.findFirst({
      where: {
        info: {
          path: ['any'],
          gt: 4,
        },
      },
    }),
  )
})()
