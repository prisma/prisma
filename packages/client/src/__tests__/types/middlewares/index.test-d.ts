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
  expectError(prisma.$use('event'))
})()
