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
    await prisma.post.deleteMany({
      where: {
        AND: {
          AND: {
            title: false,
          },
        },
      },
    }),
  )
})()
