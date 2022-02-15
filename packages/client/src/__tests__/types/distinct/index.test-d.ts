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
    await prisma.user.findMany({
      distinct: ['id', 'mail', 'age', 'followerCount', 'name'],
    }),
  )
})()
