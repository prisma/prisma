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
  // only either authorId or author needed
  expectError(
    await prisma.post.create({
      data: {
        title: '',
        published: true,
        authorId: 'a@a.de',
        author: {
          create: {
            email: 'a@a.de',
          },
        },
      },
    }),
  )
})()
