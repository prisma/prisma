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
    await prisma.user.findFirst({
      where: {
        info: {
          path: ["any"]
        },
      },
    }),
  )
  expectError(
    await prisma.user.findFirst({
      where: {
        info: {
          path: ["any"],
          gt: 4
        },
      },
    }),
  )
})()
