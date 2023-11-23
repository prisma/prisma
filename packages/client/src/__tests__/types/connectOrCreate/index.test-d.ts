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
    await prisma.user.update({
      where: {},
      data: {
        posts: {
          connectOrCreate: {
            where: {
              id: '123',
            },
            create: {
              published: true,
            },
          },
        },
      },
    }),
  )
})()
