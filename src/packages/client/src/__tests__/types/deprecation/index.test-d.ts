import { PrismaClient } from '.'
import { expectDeprecated } from 'tsd'

// tslint:disable

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:dev.db',
    },
  },
})

;(async () => {
  expectDeprecated(prisma.post.findOne)
})()
