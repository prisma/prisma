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
    await prisma.user.findMany({
      distinct: ['id', 'mail', 'age', 'followerCount', 'name'],
    }),
  )
})()
