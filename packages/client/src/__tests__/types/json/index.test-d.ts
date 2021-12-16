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
    await prisma.user.create({
      data: {
        info: {
          x: new Date(),
        },
        email: '',
      },
    }),
  )
  expectError(
    await prisma.user.create({
      data: {
        info: {
          x: /regex/,
        },
        email: '',
      },
    }),
  )
})()
